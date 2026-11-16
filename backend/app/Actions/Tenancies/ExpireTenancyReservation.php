<?php

namespace App\Actions\Tenancies;

use App\Actions\Notifications\RecordNotification;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExpireTenancyReservation
{
    public function handle(
        string $tenancyId,
        ?string $expectedContractId = null,
        ?string $expectedDeadline = null,
        ?User $actor = null,
    ): bool {
        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', $tenancyId)
            ->select('tenancies.unit_id', 'units.property_id')
            ->first();

        if ($context === null) {
            return false;
        }

        return DB::transaction(function () use (
            $tenancyId,
            $expectedContractId,
            $expectedDeadline,
            $actor,
            $context,
        ): bool {
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
                ->first();

            if (
                $tenancy === null
                || ($actor !== null
                    && $tenancy->tenant_id !== $actor->id
                    && $tenancy->owner_id !== $actor->id)
                || $tenancy->pending_contract_id === null
                || $tenancy->confirmation_expires_at === null
                || CarbonImmutable::parse($tenancy->confirmation_expires_at)
                    ->isAfter(CarbonImmutable::now())
                || ($expectedContractId !== null && $tenancy->pending_contract_id !== $expectedContractId)
                || ($expectedDeadline !== null && CarbonImmutable::parse($tenancy->confirmation_expires_at)
                    ->notEqualTo(CarbonImmutable::parse($expectedDeadline)))
            ) {
                return false;
            }

            $contract = DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $tenancy->pending_contract_id)
                ->lockForUpdate()
                ->first();

            if (
                $contract === null
                || $contract->tenant_confirmed_at !== null
                || $contract->tenant_rejected_at !== null
                || $contract->owner_confirmed_at === null
            ) {
                return false;
            }

            $isOriginal = $contract->type === 'ORIGINAL'
                && $tenancy->status === 'PENDING_CONFIRMATION'
                && $tenancy->confirmed_start_date === null
                && $tenancy->confirmed_end_date === null;
            $isRenewal = $contract->type === 'RENEWAL'
                && in_array($tenancy->status, ['CONFIRMED', 'ACTIVE'], true)
                && $tenancy->confirmed_start_date !== null
                && $tenancy->confirmed_end_date !== null
                && $contract->basis_contract_id === $tenancy->latest_confirmed_contract_id;

            if (! $isOriginal && ! $isRenewal) {
                return false;
            }

            $renewalRequest = null;
            if ($isRenewal) {
                $renewalRequest = DB::table('tenancy_renewal_requests')
                    ->where('id', $contract->renewal_request_id)
                    ->where('tenancy_id', $tenancyId)
                    ->lockForUpdate()
                    ->first();

                if ($renewalRequest === null || $renewalRequest->status !== 'PENDING') {
                    return false;
                }
            }

            $now = now();
            $newStatus = $isOriginal ? 'EXPIRED' : $tenancy->status;
            DB::table('tenancies')
                ->where('id', $tenancyId)
                ->update([
                    'status' => $newStatus,
                    'blocked_start_date' => $isOriginal ? null : $tenancy->confirmed_start_date,
                    'blocked_end_date' => $isOriginal ? null : $tenancy->confirmed_end_date,
                    'pending_contract_id' => null,
                    'confirmation_expires_at' => null,
                    'updated_at' => $now,
                ]);

            $action = $isOriginal ? 'tenancy.contract.expired' : 'tenancy.renewal.proposal.expired';
            $entityType = $isOriginal ? 'tenancy' : 'tenancy_renewal_request';
            $entityId = $isOriginal ? $tenancyId : $renewalRequest->id;

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => null,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'action' => $action,
                'before_values' => json_encode([
                    'status' => $tenancy->status,
                    'pending_contract_id' => $contract->id,
                    'confirmation_expires_at' => $tenancy->confirmation_expires_at,
                    'blocked_start_date' => $tenancy->blocked_start_date,
                    'blocked_end_date' => $tenancy->blocked_end_date,
                    'renewal_request_status' => $renewalRequest?->status,
                ], JSON_THROW_ON_ERROR),
                'after_values' => json_encode([
                    'status' => $newStatus,
                    'pending_contract_id' => null,
                    'confirmation_expires_at' => null,
                    'blocked_start_date' => $isOriginal ? null : $tenancy->confirmed_start_date,
                    'blocked_end_date' => $isOriginal ? null : $tenancy->confirmed_end_date,
                    'renewal_request_status' => $renewalRequest?->status,
                ], JSON_THROW_ON_ERROR),
                'reason' => null,
                'correlation_id' => $contract->id,
                'created_at' => $now,
            ]);

            $event = $action.':'.$contract->id;
            $title = $isOriginal ? 'Đề xuất kỳ thuê đã hết hạn' : 'Đề xuất gia hạn đã hết hạn';
            $body = $isOriginal
                ? 'Thời hạn xác nhận đề xuất thuê đã kết thúc.'
                : 'Thời hạn xác nhận gia hạn đã kết thúc. Kỳ thuê hiện tại vẫn được giữ nguyên.';

            $notifications = app(RecordNotification::class);
            $notifications->record(
                recipientId: $tenancy->tenant_id,
                audience: 'TENANT',
                eventKey: $event,
                title: $title,
                body: $body,
                resourceType: 'tenancy',
                resourceId: $tenancyId,
            );
            $notifications->record(
                recipientId: $tenancy->owner_id,
                audience: 'OWNER',
                eventKey: $event,
                title: $title,
                body: $body,
                resourceType: 'tenancy',
                resourceId: $tenancyId,
            );

            return true;
        });
    }

    public function reapDueConflicts(string $unitId, string $startDate, string $endDate): int
    {
        $now = CarbonImmutable::now()->toDateTimeString();
        $candidates = DB::table('tenancies')
            ->where('unit_id', $unitId)
            ->whereNotNull('pending_contract_id')
            ->whereNotNull('confirmation_expires_at')
            ->where('confirmation_expires_at', '<=', $now)
            ->whereRaw(
                "daterange(blocked_start_date, blocked_end_date + 1, '[)') && daterange(?::date, ?::date + 1, '[)')",
                [$startDate, $endDate],
            )
            ->orderBy('id')
            ->get(['id', 'pending_contract_id', 'confirmation_expires_at']);

        $expired = 0;
        foreach ($candidates as $candidate) {
            if ($this->handle(
                (string) $candidate->id,
                (string) $candidate->pending_contract_id,
                (string) $candidate->confirmation_expires_at,
            )) {
                $expired++;
            }
        }

        return $expired;
    }
}
