<?php

namespace App\Actions\Tenancies;

use App\Actions\Notifications\RecordNotification;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ConfirmTenancyContract
{
    /**
     * @param  array{client_operation_id: string}  $input
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
                $tenancy->pending_contract_id === $contractId
                    && $tenancy->confirmation_expires_at !== null
                    && CarbonImmutable::parse($tenancy->confirmation_expires_at)
                        ->isAfter(CarbonImmutable::now()),
                409,
                'Đề xuất này không còn là phiên bản hiện tại hoặc đã hết hạn.',
            );

            $contract = DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $contractId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless(
                $contract->tenant_confirmed_at === null
                    && $contract->tenant_rejected_at === null,
                409,
                'Bạn đã phản hồi phiên bản này rồi.',
            );

            $renewalRequest = null;
            if ($contract->type === 'ORIGINAL') {
                abort_unless(
                    $tenancy->status === 'PENDING_CONFIRMATION',
                    409,
                    'Đề xuất thuê ban đầu không còn chờ xác nhận.',
                );
            } elseif ($contract->type === 'RENEWAL') {
                abort_unless(
                    in_array($tenancy->status, ['CONFIRMED', 'ACTIVE'], true)
                        && $tenancy->confirmed_start_date !== null
                        && $tenancy->confirmed_end_date !== null
                        && $tenancy->blocked_start_date === $tenancy->confirmed_start_date
                        && $contract->owner_confirmed_at !== null
                        && $contract->renewal_request_id !== null
                        && $contract->basis_contract_id === $tenancy->latest_confirmed_contract_id
                        && $contract->start_date === CarbonImmutable::parse($tenancy->confirmed_end_date)
                            ->addDay()
                            ->toDateString(),
                    409,
                    'Đề xuất gia hạn không còn phù hợp với thỏa thuận hiện tại.',
                );

                $renewalRequest = DB::table('tenancy_renewal_requests')
                    ->where('id', $contract->renewal_request_id)
                    ->where('tenancy_id', $tenancyId)
                    ->lockForUpdate()
                    ->first();

                abort_unless(
                    $renewalRequest !== null && $renewalRequest->status === 'PENDING',
                    409,
                    'Đề nghị gia hạn không còn chờ xử lý.',
                );
            } else {
                abort(409, 'Loại phiên bản hợp đồng không hợp lệ.');
            }
            $now = now();

            DB::select(
                'SELECT set_config(?, ?, true)',
                ['rentos.actor_id', $tenant->id],
            );

            DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $contractId)
                ->update(['tenant_confirmed_at' => $now]);

            if ($contract->type === 'ORIGINAL') {
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
            } else {
                DB::table('tenancy_renewal_requests')
                    ->where('id', $renewalRequest->id)
                    ->where('tenancy_id', $tenancyId)
                    ->update(['status' => 'ACCEPTED', 'updated_at' => $now]);

                DB::table('tenancies')
                    ->where('id', $tenancyId)
                    ->update([
                        'confirmed_end_date' => $contract->end_date,
                        'blocked_end_date' => $contract->end_date,
                        'latest_confirmed_contract_id' => $contractId,
                        'pending_contract_id' => null,
                        'confirmation_expires_at' => null,
                        'updated_at' => $now,
                    ]);
            }

            $auditAction = $contract->type === 'RENEWAL'
                ? 'tenancy.renewal.accepted'
                : 'tenancy.contract.confirmed';

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $tenant->id,
                'entity_type' => $contract->type === 'RENEWAL' ? 'tenancy_renewal_request' : 'tenancy',
                'entity_id' => $contract->type === 'RENEWAL' ? $renewalRequest->id : $tenancyId,
                'action' => $auditAction,
                'before_values' => json_encode([
                    'status' => $tenancy->status,
                    'pending_contract_id' => $contractId,
                    'confirmed_end_date' => $tenancy->confirmed_end_date,
                    'renewal_request_status' => $renewalRequest?->status,
                ], JSON_THROW_ON_ERROR),
                'after_values' => json_encode([
                    'status' => $tenancy->status === 'PENDING_CONFIRMATION' ? 'CONFIRMED' : $tenancy->status,
                    'contract_id' => $contractId,
                    'confirmed_end_date' => $contract->end_date,
                    'renewal_request_status' => $contract->type === 'RENEWAL' ? 'ACCEPTED' : null,
                ], JSON_THROW_ON_ERROR),
                'reason' => null,
                'correlation_id' => $input['client_operation_id'],
                'created_at' => $now,
            ]);

            app(RecordNotification::class)->record(
                recipientId: $tenancy->owner_id,
                audience: 'OWNER',
                eventKey: ($contract->type === 'RENEWAL' ? 'tenancy.renewal.accepted:' : 'tenancy.contract.confirmed:').$contractId,
                title: $contract->type === 'RENEWAL'
                    ? 'Người thuê đã xác nhận gia hạn'
                    : 'Người thuê đã xác nhận hợp đồng',
                body: $contract->type === 'RENEWAL'
                    ? 'Người thuê đã xác nhận phiên bản gia hạn kỳ thuê.'
                    : 'Đề xuất kỳ thuê của bạn đã được người thuê xác nhận.',
                resourceType: 'tenancy',
                resourceId: $tenancyId,
                actorId: $tenant->id,
                sendEmail: true,
            );

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
