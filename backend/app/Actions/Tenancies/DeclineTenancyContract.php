<?php

namespace App\Actions\Tenancies;

use App\Actions\Notifications\RecordNotification;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeclineTenancyContract
{
    /**
     * @param array{
     *     client_operation_id: string,
     *     reason: string
     * } $input
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    public function handle(
        User $tenant,
        string $tenancyId,
        string $contractId,
        array $input,
    ): array {
        $reason = trim($input['reason']);

        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => $tenancyId,
            'contract_id' => $contractId,
            'reason' => $reason,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', $tenancyId)
            ->select('tenancies.unit_id', 'units.property_id')
            ->first();

        abort_if($context === null, 404);

        return DB::transaction(function () use (
            $tenant,
            $tenancyId,
            $contractId,
            $input,
            $reason,
            $requestHash,
            $context,
        ): array {
            Property::query()
                ->whereKey($context->property_id)
                ->lockForUpdate()
                ->firstOrFail();

            Unit::query()
                ->whereKey($context->unit_id)
                ->where('property_id', $context->property_id)
                ->lockForUpdate()
                ->firstOrFail();

            $tenancy = DB::table('tenancies')
                ->where('id', $tenancyId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($tenancy->tenant_id === $tenant->id, 404);

            DB::select(
                'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))',
                [$tenant->id.':tenancy.contract.decline:'.$input['client_operation_id']],
            );

            $replay = DB::table('idempotency_records')
                ->where('actor_id', $tenant->id)
                ->where('action', 'tenancy.contract.decline')
                ->where('client_operation_id', $input['client_operation_id'])
                ->first();

            if ($replay !== null) {
                abort_unless(hash_equals($replay->request_hash, $requestHash), 409);

                return $this->result($tenancyId, $contractId, true);
            }

            abort_unless(
                $tenancy->status === 'PENDING_CONFIRMATION'
                    && $tenancy->pending_contract_id === $contractId
                    && $tenancy->confirmation_expires_at !== null
                    && CarbonImmutable::parse($tenancy->confirmation_expires_at)
                        ->isAfter(CarbonImmutable::now()),
                409,
                'This contract is no longer the current, unexpired proposal.',
            );

            $contract = DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $contractId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($contract->type === 'ORIGINAL', 409);
            abort_unless(
                $contract->tenant_confirmed_at === null
                    && $contract->tenant_rejected_at === null,
                409,
                'This contract already has a tenant decision.',
            );
            $now = now();

            DB::select(
                'SELECT set_config(?, ?, true)',
                ['rentos.actor_id', $tenant->id],
            );

            DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $contractId)
                ->update([
                    'tenant_rejected_at' => $now,
                    'tenant_rejection_reason' => $reason,
                ]);

            DB::table('tenancies')
                ->where('id', $tenancyId)
                ->update([
                    'status' => 'AWAITING_REVISION',
                    'blocked_start_date' => null,
                    'blocked_end_date' => null,
                    'pending_contract_id' => null,
                    'confirmation_expires_at' => null,
                    'updated_at' => $now,
                ]);

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $tenant->id,
                'entity_type' => 'tenancy',
                'entity_id' => $tenancyId,
                'action' => 'tenancy.contract.declined',
                'before_values' => json_encode([
                    'status' => $tenancy->status,
                    'pending_contract_id' => $contractId,
                ], JSON_THROW_ON_ERROR),
                'after_values' => json_encode([
                    'status' => 'AWAITING_REVISION',
                    'contract_id' => $contractId,
                    'reason' => $reason,
                ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'reason' => $reason,
                'correlation_id' => $input['client_operation_id'],
                'created_at' => $now,
            ]);

            app(RecordNotification::class)->record(
                recipientId: $tenancy->owner_id,
                audience: 'OWNER',
                eventKey: 'tenancy.contract.declined:'.$contractId,
                title: 'Người thuê đã từ chối đề xuất',
                body: 'Người thuê đã từ chối đề xuất kỳ thuê của bạn.',
                resourceType: 'tenancy',
                resourceId: $tenancyId,
            );

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $tenant->id,
                'action' => 'tenancy.contract.decline',
                'client_operation_id' => $input['client_operation_id'],
                'request_hash' => $requestHash,
                'result_resource_type' => 'tenancy',
                'result_ids' => '{'.$tenancyId.'}',
                'response_status' => 200,
                'created_at' => $now,
            ]);

            return $this->result($tenancyId, $contractId, false);
        }, 3);
    }

    /**
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    private function result(
        string $tenancyId,
        string $contractId,
        bool $replayed,
    ): array {
        return [
            'tenancy' => DB::table('tenancies')
                ->where('id', $tenancyId)
                ->firstOrFail(),
            'contract' => DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $contractId)
                ->firstOrFail(),
            'replayed' => $replayed,
        ];
    }
}
