<?php

namespace App\Actions\RentalRequests;

use App\Models\RentalRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CloseRentalRequest
{
    public function withdraw(User $actor, string $id, string $expectedUpdatedAt, string $operationId, ?string $reason): void
    {
        $this->close($actor, $id, $expectedUpdatedAt, $operationId, $reason, 'WITHDRAWN');
    }

    public function reject(User $actor, string $id, string $expectedUpdatedAt, string $operationId, string $reason): void
    {
        $this->close($actor, $id, $expectedUpdatedAt, $operationId, $reason, 'REJECTED');
    }

    /** @param 'WITHDRAWN'|'REJECTED' $outcome */
    private function close(User $actor, string $id, string $expectedUpdatedAt, string $operationId, ?string $reason, string $outcome): void
    {
        $rejecting = $outcome === 'REJECTED';
        $event = $rejecting ? 'rental_request.rejected' : 'rental_request.withdrawn';
        $hash = hash('sha256', json_encode([$id, $expectedUpdatedAt, $reason], JSON_THROW_ON_ERROR));

        DB::transaction(function () use ($actor, $id, $expectedUpdatedAt, $operationId, $reason, $hash, $outcome, $rejecting, $event): void {
            // Serialize retries for this actor while allowing the competing actor's outbox foreign key check.
            $user = User::query()->lock('for no key update')->findOrFail($actor->id);
            Gate::forUser($user)->authorize($rejecting ? 'viewOwnerInbox' : 'viewAny', RentalRequest::class);
            $query = RentalRequest::query();
            $request = ($rejecting ? $query->forOwner($user) : $query->where('tenant_id', $user->id))
                ->lockForUpdate()->findOrFail($id);
            Gate::forUser($user)->authorize($rejecting ? 'reject' : 'withdraw', $request);

            $replay = DB::table('idempotency_records')->where([
                'actor_id' => $user->id,
                'action' => $event,
                'client_operation_id' => $operationId,
            ])->first();
            if ($replay !== null) {
                abort_unless(hash_equals($replay->request_hash, $hash), 409, 'Mã thao tác đã được dùng cho nội dung khác.');

                return;
            }

            abort_if(! $rejecting && $request->status === 'ACCEPTED', 409, 'Chủ nhà đã gửi đề xuất. Hãy mở Căn hộ và hợp đồng để tiếp tục.');
            abort_unless(
                $request->status === 'PENDING' && $request->updated_at->equalTo(Carbon::parse($expectedUpdatedAt)),
                409,
                'Yêu cầu đã thay đổi. Vui lòng tải lại và kiểm tra trạng thái mới.',
            );

            $recipientId = $rejecting ? $request->tenant_id : DB::table('listings')->join('properties', 'properties.id', '=', 'listings.property_id')
                ->where('listings.id', $request->listing_id)->value('properties.owner_id');

            $request->forceFill([
                'status' => $outcome,
                'outcome_reason' => $reason,
                'closed_at' => now(),
            ])->save();

            DB::table('audit_logs')->insert([
                'actor_id' => $user->id,
                'entity_type' => 'rental_request',
                'entity_id' => $id,
                'action' => $event,
                'before_values' => json_encode(['status' => 'PENDING'], JSON_THROW_ON_ERROR),
                'after_values' => json_encode(['status' => $outcome], JSON_THROW_ON_ERROR),
                'reason' => $reason,
                'correlation_id' => $operationId,
            ]);
            DB::table('notification_outbox')->insert([
                'event_key' => $event.':'.$id,
                'recipient_id' => $recipientId,
                'event_type' => $event,
                'payload' => json_encode(['rental_request_id' => $id, 'listing_id' => $request->listing_id], JSON_THROW_ON_ERROR),
            ]);
            DB::table('idempotency_records')->insert([
                'actor_id' => $user->id,
                'action' => $event,
                'client_operation_id' => $operationId,
                'request_hash' => $hash,
                'result_resource_type' => 'rental_request',
                'result_ids' => '{'.$id.'}',
                'response_status' => 204,
            ]);
        }, 3);
    }
}
