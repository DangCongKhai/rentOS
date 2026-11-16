<?php

namespace App\Actions\Tenancies;

use App\Actions\Notifications\RecordNotification;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RequestTenancyRenewal
{
    private const string EVENT = 'tenancy.renewal.requested';

    /**
     * @param  array{client_operation_id: string, requested_end_date: string, proposed_monthly_rent: int|string, message?: string|null}  $input
     * @return array{renewal_request: object, created: bool}
     */
    public function handle(User $tenant, string $tenancyId, array $input): array
    {
        $operationId = strtolower($input['client_operation_id']);
        $attributes = [
            'requested_end_date' => $input['requested_end_date'],
            'proposed_monthly_rent' => (int) $input['proposed_monthly_rent'],
            'message' => $input['message'] ?? null,
        ];
        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => strtolower($tenancyId),
            ...$attributes,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', strtolower($tenancyId))
            ->select('tenancies.unit_id', 'units.property_id')
            ->first();

        abort_if($context === null, 404);

        $renewalRequestId = (string) Str::uuid();

        return DB::transaction(function () use (
            $tenant,
            $tenancyId,
            $operationId,
            $attributes,
            $requestHash,
            $renewalRequestId,
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
                ->where('id', strtolower($tenancyId))
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($tenancy->tenant_id === $tenant->id, 404);
            abort_unless(
                $tenancy->unit_id === $unit->id
                    && $tenancy->owner_id === $property->owner_id,
                409,
            );

            DB::select(
                'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))',
                [$tenant->id.':'.self::EVENT.':'.$operationId],
            );

            $replay = DB::table('idempotency_records')
                ->where('actor_id', $tenant->id)
                ->where('action', self::EVENT)
                ->where('client_operation_id', $operationId)
                ->first();

            if ($replay !== null) {
                abort_unless(
                    hash_equals($replay->request_hash, $requestHash),
                    409,
                    'Mã thao tác đã được dùng cho nội dung khác.',
                );

                return [
                    'renewal_request' => DB::table('tenancy_renewal_requests')
                        ->where('client_operation_id', $operationId)
                        ->where('tenancy_id', strtolower($tenancyId))
                        ->firstOrFail(),
                    'created' => false,
                ];
            }

            abort_unless(
                in_array($tenancy->status, ['CONFIRMED', 'ACTIVE'], true)
                    && $tenancy->confirmed_end_date !== null,
                409,
                'Chỉ có thể đề nghị gia hạn kỳ thuê đã được xác nhận hoặc đang hoạt động.',
            );

            $requestedEndDate = CarbonImmutable::parse($attributes['requested_end_date']);
            $confirmedEndDate = CarbonImmutable::parse($tenancy->confirmed_end_date);

            if ($requestedEndDate->lessThanOrEqualTo($confirmedEndDate)
                || $requestedEndDate->lessThanOrEqualTo(CarbonImmutable::today())) {
                throw ValidationException::withMessages([
                    'requested_end_date' => 'Ngày kết thúc đề xuất phải sau ngày kết thúc hiện tại và trong tương lai.',
                ]);
            }

            $hasPendingRenewal = DB::table('tenancy_renewal_requests')
                ->where('tenancy_id', $tenancy->id)
                ->where('status', 'PENDING')
                ->exists();

            abort_unless(
                ! $hasPendingRenewal,
                409,
                'Kỳ thuê này đã có một đề nghị gia hạn đang chờ xử lý.',
            );

            $hasUpcomingConfirmedRenewal = DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancy->id)
                ->where('type', 'RENEWAL')
                ->whereNotNull('tenant_confirmed_at')
                ->whereNull('tenant_rejected_at')
                ->whereDate('start_date', '>', CarbonImmutable::today()->toDateString())
                ->exists();

            abort_unless(
                ! $hasUpcomingConfirmedRenewal,
                409,
                'Kỳ thuê này đã có một kỳ gia hạn sắp tới được xác nhận.',
            );

            DB::select(
                'SELECT set_config(?, ?, true)',
                ['rentos.actor_id', $tenant->id],
            );

            $now = now();
            $inserted = DB::table('tenancy_renewal_requests')->insertOrIgnore([
                'id' => $renewalRequestId,
                'tenancy_id' => $tenancy->id,
                'client_operation_id' => $operationId,
                'requested_end_date' => $attributes['requested_end_date'],
                'proposed_monthly_rent' => $attributes['proposed_monthly_rent'],
                'message' => $attributes['message'],
                'status' => 'PENDING',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            abort_unless(
                $inserted === 1,
                409,
                'Kỳ thuê này đã có một đề nghị gia hạn đang chờ xử lý.',
            );

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $tenant->id,
                'entity_type' => 'tenancy_renewal_request',
                'entity_id' => $renewalRequestId,
                'action' => self::EVENT,
                'before_values' => null,
                'after_values' => json_encode([
                    'status' => 'PENDING',
                    ...$attributes,
                ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'reason' => null,
                'correlation_id' => $operationId,
                'created_at' => $now,
            ]);

            app(RecordNotification::class)->record(
                recipientId: $tenancy->owner_id,
                audience: 'OWNER',
                eventKey: self::EVENT.':'.$renewalRequestId,
                title: 'Người thuê đề nghị gia hạn kỳ thuê',
                body: 'Bạn có một đề nghị gia hạn mới cần xem xét.',
                resourceType: 'tenancy',
                resourceId: $tenancy->id,
                actorId: $tenant->id,
            );

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $tenant->id,
                'action' => self::EVENT,
                'client_operation_id' => $operationId,
                'request_hash' => $requestHash,
                'result_resource_type' => 'tenancy_renewal_request',
                'result_ids' => '{'.$renewalRequestId.'}',
                'response_status' => 201,
                'created_at' => $now,
            ]);

            return [
                'renewal_request' => DB::table('tenancy_renewal_requests')
                    ->where('id', $renewalRequestId)
                    ->firstOrFail(),
                'created' => true,
            ];
        });
    }
}
