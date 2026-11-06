<?php

namespace App\Actions\RentalRequests;

use App\Models\RentalRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class WithdrawRentalRequest
{
    private const string EVENT = 'rental_request.withdrawn';

    public function handle(User $actor, string $id, string $expectedUpdatedAt, string $operationId, ?string $reason): void
    {
        $hash = hash('sha256', json_encode([$id, $expectedUpdatedAt, $reason], JSON_THROW_ON_ERROR));

        DB::transaction(function () use ($actor, $id, $expectedUpdatedAt, $operationId, $reason, $hash): void {
            $tenant = User::query()->lockForUpdate()->findOrFail($actor->id);
            Gate::forUser($tenant)->authorize('viewAny', RentalRequest::class);
            $request = RentalRequest::query()->where('tenant_id', $tenant->id)->lockForUpdate()->findOrFail($id);
            Gate::forUser($tenant)->authorize('withdraw', $request);

            $replay = DB::table('idempotency_records')->where([
                'actor_id' => $tenant->id,
                'action' => self::EVENT,
                'client_operation_id' => $operationId,
            ])->first();
            if ($replay !== null) {
                abort_unless(hash_equals($replay->request_hash, $hash), 409, 'Mã thao tác đã được dùng cho nội dung khác.');

                return;
            }

            abort_if($request->status === 'ACCEPTED', 409, 'Chủ nhà đã gửi đề xuất. Hãy mở Căn hộ và hợp đồng để tiếp tục.');
            abort_unless(
                $request->status === 'PENDING' && $request->updated_at->equalTo(Carbon::parse($expectedUpdatedAt)),
                409,
                'Yêu cầu đã thay đổi. Vui lòng tải lại và kiểm tra trạng thái mới.',
            );

            $ownerId = DB::table('listings')->join('properties', 'properties.id', '=', 'listings.property_id')
                ->where('listings.id', $request->listing_id)->value('properties.owner_id');

            $request->forceFill([
                'status' => 'WITHDRAWN',
                'outcome_reason' => $reason,
                'closed_at' => now(),
            ])->save();

            DB::table('audit_logs')->insert([
                'actor_id' => $tenant->id,
                'entity_type' => 'rental_request',
                'entity_id' => $id,
                'action' => self::EVENT,
                'before_values' => json_encode(['status' => 'PENDING'], JSON_THROW_ON_ERROR),
                'after_values' => json_encode(['status' => 'WITHDRAWN'], JSON_THROW_ON_ERROR),
                'reason' => $reason,
                'correlation_id' => $operationId,
            ]);
            DB::table('notification_outbox')->insert([
                'event_key' => self::EVENT.':'.$id,
                'recipient_id' => $ownerId,
                'event_type' => self::EVENT,
                'payload' => json_encode(['rental_request_id' => $id, 'listing_id' => $request->listing_id], JSON_THROW_ON_ERROR),
            ]);
            DB::table('idempotency_records')->insert([
                'actor_id' => $tenant->id,
                'action' => self::EVENT,
                'client_operation_id' => $operationId,
                'request_hash' => $hash,
                'result_resource_type' => 'rental_request',
                'result_ids' => '{'.$id.'}',
                'response_status' => 204,
            ]);
        }, 3);
    }
}
