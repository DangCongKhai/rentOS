<?php

namespace App\Actions\Listings;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DecideListingReview
{
    public function __construct(private ReadListingReviewPackage $packages) {}

    public function handle(User $actor, string $listingId, bool $approve, array $input): array
    {
        $action = $approve ? 'listing.approve' : 'listing.reject';
        $reason = $approve ? null : $input['reason'];
        $operationId = $input['client_operation_id'];
        $requestHash = hash('sha256', json_encode([$listingId, $input['expected_snapshot'], $reason], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($actor, $listingId, $approve, $input, $action, $reason, $operationId, $requestHash): array {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$actor->id.':'.$action.':'.$operationId]);
            $replay = DB::table('idempotency_records')->where('actor_id', $actor->id)->where('action', $action)->where('client_operation_id', $operationId)->first();
            if ($replay !== null) {
                abort_unless(hash_equals($replay->request_hash, $requestHash), 409, 'Mã thao tác đã được sử dụng cho một yêu cầu khác.');

                return $this->packages->locked($listingId);
            }

            $package = $this->packages->locked($listingId);
            abort_unless($package['moderation_status'] === 'PENDING' && $package['reviewed_at'] === null, 409, 'Gói tin đã có quyết định hoặc không còn trong hàng đợi. Vui lòng tải lại.');
            abort_unless(hash_equals($package['snapshot_token'], $input['expected_snapshot']) && $package['submitted_content_revision'] === $package['property']['content_revision'], 409, 'Nội dung gói tin đã thay đổi. Vui lòng tải lại và xem xét lại.');
            abort_if($approve && ! $package['completeness']['complete'], 409, 'Gói tin chưa đủ điều kiện phê duyệt.');

            $now = now();
            $status = $approve ? 'APPROVED' : 'REJECTED';
            $changes = ['moderation_status' => $status, 'reviewed_by' => $actor->id, 'reviewed_at' => $now, 'review_reason' => $reason, 'updated_at' => $now];
            if ($approve) {
                $changes['approved_content_revision'] = $package['property']['content_revision'];
            }
            DB::table('listings')->where('id', $listingId)->update($changes);
            $event = $approve ? 'listing.approved' : 'listing.rejected';
            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(), 'actor_id' => $actor->id, 'entity_type' => 'listing', 'entity_id' => $listingId,
                'action' => $event, 'before_values' => json_encode(['moderation_status' => 'PENDING', 'snapshot_token' => $package['snapshot_token']], JSON_THROW_ON_ERROR),
                'after_values' => json_encode(['moderation_status' => $status, 'publication_status' => $package['publication_status'], 'submitted_content_revision' => $package['submitted_content_revision'], 'approved_content_revision' => $approve ? $package['property']['content_revision'] : null], JSON_THROW_ON_ERROR),
                'reason' => $reason, 'correlation_id' => $operationId, 'created_at' => $now,
            ]);
            DB::table('notification_outbox')->insert([
                'id' => (string) Str::uuid(), 'event_key' => $event.':'.$listingId.':'.$operationId,
                'recipient_id' => $package['owner']['id'], 'event_type' => $event,
                'payload' => json_encode(['listing_id' => $listingId, 'title' => $package['title'], 'reason' => $reason], JSON_THROW_ON_ERROR),
                'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(), 'actor_id' => $actor->id, 'action' => $action, 'client_operation_id' => $operationId,
                'request_hash' => $requestHash, 'result_resource_type' => 'listing', 'result_ids' => '{'.$listingId.'}',
                'response_status' => 200, 'created_at' => $now,
            ]);

            return $this->packages->locked($listingId);
        }, 3);
    }
}
