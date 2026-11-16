<?php

namespace App\Actions\Tenancies;

use App\Actions\Notifications\RecordNotification;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ResolveTenancyRenewalRequest
{
    /**
     * @param  'withdraw'|'reject'  $transition
     * @param  array{client_operation_id: string, reason?: string}  $input
     * @return array{renewal_request: object, tenancy: object, replayed: bool}
     */
    public function handle(
        User $actor,
        string $tenancyId,
        string $renewalRequestId,
        string $transition,
        array $input,
    ): array {
        abort_unless(in_array($transition, ['withdraw', 'reject'], true), 400);

        $tenancyId = strtolower($tenancyId);
        $renewalRequestId = strtolower($renewalRequestId);
        $operationId = strtolower($input['client_operation_id']);
        $reason = $transition === 'reject' ? trim($input['reason'] ?? '') : null;
        $event = 'tenancy.renewal.'.($transition === 'withdraw' ? 'withdrawn' : 'rejected');
        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => $tenancyId,
            'renewal_request_id' => $renewalRequestId,
            'transition' => $transition,
            'reason' => $reason,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', $tenancyId)
            ->select('tenancies.unit_id', 'units.property_id')
            ->first();

        abort_if($context === null, 404);

        return DB::transaction(function () use (
            $actor,
            $tenancyId,
            $renewalRequestId,
            $transition,
            $operationId,
            $reason,
            $event,
            $requestHash,
            $context,
        ): array {
            $property = Property::query()
                ->whereKey($context->property_id)
                ->lockForUpdate()
                ->firstOrFail();

            $unit = Unit::query()
                ->whereKey($context->unit_id)
                ->where('property_id', $property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $tenancy = DB::table('tenancies')
                ->where('id', $tenancyId)
                ->lockForUpdate()
                ->firstOrFail();

            $isTenantAction = $transition === 'withdraw';
            abort_unless(
                $tenancy->unit_id === $unit->id
                    && $tenancy->owner_id === $property->owner_id
                    && ($isTenantAction
                        ? $tenancy->tenant_id === $actor->id
                        : $tenancy->owner_id === $actor->id),
                404,
            );

            DB::select(
                'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))',
                [$actor->id.':'.$event.':'.$operationId],
            );

            $replay = DB::table('idempotency_records')
                ->where('actor_id', $actor->id)
                ->where('action', $event)
                ->where('client_operation_id', $operationId)
                ->first();

            if ($replay !== null) {
                abort_unless(hash_equals($replay->request_hash, $requestHash), 409,
                    'Mã thao tác đã được dùng cho nội dung khác.');

                return $this->result($tenancyId, $renewalRequestId, true);
            }

            abort_unless(
                in_array($tenancy->status, ['CONFIRMED', 'ACTIVE'], true)
                    && $tenancy->confirmed_start_date !== null
                    && $tenancy->confirmed_end_date !== null,
                409,
                'Chỉ có thể xử lý đề nghị gia hạn của kỳ thuê đã được xác nhận hoặc đang hoạt động.',
            );

            $renewalRequestExists = DB::table('tenancy_renewal_requests')
                ->where('id', $renewalRequestId)
                ->where('tenancy_id', $tenancyId)
                ->exists();

            abort_unless($renewalRequestExists, 404);

            $pendingContractId = null;
            if ($tenancy->pending_contract_id !== null) {
                $pendingContract = DB::table('tenancy_contracts')
                    ->where('id', $tenancy->pending_contract_id)
                    ->where('tenancy_id', $tenancyId)
                    ->lockForUpdate()
                    ->first();

                abort_unless(
                    $pendingContract !== null
                        && $pendingContract->type === 'RENEWAL'
                        && $pendingContract->renewal_request_id === $renewalRequestId,
                    409,
                    'Kỳ thuê đang có một đề xuất khác cần được xử lý trước.',
                );

                $pendingContractId = $pendingContract->id;
            }

            $renewalRequest = DB::table('tenancy_renewal_requests')
                ->where('id', $renewalRequestId)
                ->where('tenancy_id', $tenancyId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless(
                $renewalRequest->status === 'PENDING',
                409,
                'Đề nghị gia hạn này không còn chờ xử lý.',
            );

            DB::select(
                'SELECT set_config(?, ?, true)',
                ['rentos.actor_id', $actor->id],
            );

            $now = now();
            DB::table('tenancies')
                ->where('id', $tenancyId)
                ->update([
                    'blocked_end_date' => $tenancy->confirmed_end_date,
                    'pending_contract_id' => null,
                    'confirmation_expires_at' => null,
                    'updated_at' => $now,
                ]);

            DB::table('tenancy_renewal_requests')
                ->where('id', $renewalRequestId)
                ->update([
                    'status' => $transition === 'withdraw' ? 'CANCELLED' : 'REJECTED',
                    'reviewed_by' => $actor->id,
                    'reviewed_at' => $now,
                    'review_reason' => $reason,
                    'updated_at' => $now,
                ]);

            $status = $transition === 'withdraw' ? 'CANCELLED' : 'REJECTED';
            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $actor->id,
                'entity_type' => 'tenancy_renewal_request',
                'entity_id' => $renewalRequestId,
                'action' => $event,
                'before_values' => json_encode([
                    'status' => 'PENDING',
                    'pending_contract_id' => $pendingContractId,
                    'blocked_end_date' => $tenancy->blocked_end_date,
                ], JSON_THROW_ON_ERROR),
                'after_values' => json_encode([
                    'status' => $status,
                    'pending_contract_id' => null,
                    'blocked_end_date' => $tenancy->confirmed_end_date,
                    'reason' => $reason,
                ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'reason' => $reason,
                'correlation_id' => $operationId,
                'created_at' => $now,
            ]);

            $recipientId = $isTenantAction ? $tenancy->owner_id : $tenancy->tenant_id;
            $audience = $isTenantAction ? 'OWNER' : 'TENANT';
            app(RecordNotification::class)->record(
                recipientId: $recipientId,
                audience: $audience,
                eventKey: $event.':'.$renewalRequestId,
                title: $isTenantAction
                    ? 'Người thuê đã rút đề nghị gia hạn'
                    : 'Chủ nhà đã từ chối đề nghị gia hạn',
                body: $isTenantAction
                    ? 'Người thuê đã rút đề nghị gia hạn kỳ thuê.'
                    : 'Chủ nhà đã từ chối đề nghị gia hạn kỳ thuê.',
                resourceType: 'tenancy',
                resourceId: $tenancyId,
                actorId: $actor->id,
            );

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $actor->id,
                'action' => $event,
                'client_operation_id' => $operationId,
                'request_hash' => $requestHash,
                'result_resource_type' => 'tenancy_renewal_request',
                'result_ids' => '{'.$renewalRequestId.'}',
                'response_status' => 200,
                'created_at' => $now,
            ]);

            return $this->result($tenancyId, $renewalRequestId, false);
        });
    }

    /**
     * @return array{renewal_request: object, tenancy: object, replayed: bool}
     */
    private function result(string $tenancyId, string $renewalRequestId, bool $replayed): array
    {
        return [
            'renewal_request' => DB::table('tenancy_renewal_requests')
                ->where('id', $renewalRequestId)
                ->where('tenancy_id', $tenancyId)
                ->firstOrFail(),
            'tenancy' => DB::table('tenancies')->where('id', $tenancyId)->firstOrFail(),
            'replayed' => $replayed,
        ];
    }
}
