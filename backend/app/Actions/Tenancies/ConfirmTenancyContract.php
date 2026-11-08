<?php

namespace App\Actions\Tenancies;

use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ConfirmTenancyContract
{
    /**
     * @param  array{client_operation_id: string, document_sha256: string}  $input
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    public function handle(
        User $tenant,
        string $tenancyId,
        string $contractId,
        array $input,
    ): array {
        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => $tenancyId,
            'contract_id' => $contractId,
            'document_sha256' => $input['document_sha256'],
        ], JSON_THROW_ON_ERROR));

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
                [$tenant->id.':tenancy.contract.confirm:'.$input['client_operation_id']],
            );

            $replay = DB::table('idempotency_records')
                ->where('actor_id', $tenant->id)
                ->where('action', 'tenancy.contract.confirm')
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
            abort_unless(
                hash_equals($contract->document_sha256, $input['document_sha256']),
                409,
                'The contract document hash does not match.',
            );

            $now = now();

            DB::select(
                'SELECT set_config(?, ?, true)',
                ['rentos.actor_id', $tenant->id],
            );

            DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $contractId)
                ->update(['tenant_confirmed_at' => $now]);

            DB::table('tenancies')
                ->where('id', $tenancyId)
                ->update([
                    'status' => 'CONFIRMED',
                    'confirmed_start_date' => $contract->start_date,
                    'confirmed_end_date' => $contract->end_date,
                    'blocked_start_date' => $contract->start_date,
                    'blocked_end_date' => $contract->end_date,
                    'latest_confirmed_contract_id' => $contractId,
                    'pending_contract_id' => null,
                    'confirmation_expires_at' => null,
                    'updated_at' => $now,
                ]);

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $tenant->id,
                'entity_type' => 'tenancy',
                'entity_id' => $tenancyId,
                'action' => 'tenancy.contract.confirmed',
                'before_values' => json_encode([
                    'status' => $tenancy->status,
                    'pending_contract_id' => $contractId,
                ], JSON_THROW_ON_ERROR),
                'after_values' => json_encode([
                    'status' => 'CONFIRMED',
                    'contract_id' => $contractId,
                    'document_sha256' => $contract->document_sha256,
                ], JSON_THROW_ON_ERROR),
                'reason' => null,
                'correlation_id' => $input['client_operation_id'],
                'created_at' => $now,
            ]);

            DB::table('notification_outbox')->insert([
                'id' => (string) Str::uuid(),
                'event_key' => 'tenancy.contract.confirmed:'.$contractId,
                'recipient_id' => $tenancy->owner_id,
                'event_type' => 'tenancy.contract.confirmed',
                'payload' => json_encode([
                    'tenancy_id' => $tenancyId,
                    'contract_id' => $contractId,
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $tenant->id,
                'action' => 'tenancy.contract.confirm',
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
    private function result(string $tenancyId, string $contractId, bool $replayed): array
    {
        return [
            'tenancy' => DB::table('tenancies')->where('id', $tenancyId)->firstOrFail(),
            'contract' => DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $contractId)
                ->firstOrFail(),
            'replayed' => $replayed,
        ];
    }
}
