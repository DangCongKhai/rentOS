<?php

namespace App\Actions\Tenancies;

use App\Actions\Notifications\RecordNotification;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProposeTenancyRenewal
{
    private const string ACTION = 'tenancy.renewal.proposed';

    /**
     * @param  array{client_operation_id: string, end_date: string, monthly_rent: int|string, deposit_amount: int|string, policies_snapshot: array<string, mixed>}  $input
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    public function handle(User $owner, string $tenancyId, string $renewalRequestId, array $input): array
    {
        $tenancyId = strtolower($tenancyId);
        $renewalRequestId = strtolower($renewalRequestId);
        $operationId = strtolower($input['client_operation_id']);
        $attributes = [
            'end_date' => $input['end_date'],
            'monthly_rent' => (int) $input['monthly_rent'],
            'deposit_amount' => (int) $input['deposit_amount'],
            'policies_snapshot' => $this->canonicalize($input['policies_snapshot']),
        ];
        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => $tenancyId,
            'renewal_request_id' => $renewalRequestId,
            ...$attributes,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', $tenancyId)
            ->join('properties', 'properties.id', '=', 'units.property_id')
            ->select(
                'tenancies.unit_id',
                'units.property_id',
                'properties.owner_id',
                'tenancies.confirmed_end_date',
            )
            ->first();

        abort_if($context === null, 404);
        abort_unless($context->owner_id === $owner->id, 404);
        abort_unless($context->confirmed_end_date !== null, 409);

        app(ExpireTenancyReservation::class)->reapDueConflicts(
            (string) $context->unit_id,
            CarbonImmutable::parse($context->confirmed_end_date)->addDay()->toDateString(),
            $attributes['end_date'],
        );

        $contractId = (string) Str::uuid();

        try {
            return DB::transaction(function () use (
                $owner,
                $tenancyId,
                $renewalRequestId,
                $operationId,
                $attributes,
                $requestHash,
                $contractId,
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

                abort_unless(
                    $property->owner_id === $owner->id
                        && $tenancy->owner_id === $owner->id
                        && $tenancy->unit_id === $unit->id,
                    404,
                );

                DB::select(
                    'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))',
                    [$owner->id.':'.self::ACTION.':'.$operationId],
                );

                $replay = DB::table('idempotency_records')
                    ->where('actor_id', $owner->id)
                    ->where('action', self::ACTION)
                    ->where('client_operation_id', $operationId)
                    ->first();

                if ($replay !== null) {
                    abort_unless(hash_equals($replay->request_hash, $requestHash), 409,
                        'Mã thao tác đã được dùng cho nội dung khác.');

                    $resultIds = explode(',', trim((string) $replay->result_ids, '{}'));
                    abort_unless(count($resultIds) === 2, 409);

                    return $this->result($resultIds[0], $resultIds[1], true);
                }

                abort_unless(
                    in_array($tenancy->status, ['CONFIRMED', 'ACTIVE'], true)
                        && $tenancy->confirmed_start_date !== null
                        && $tenancy->confirmed_end_date !== null
                        && $tenancy->latest_confirmed_contract_id !== null,
                    409,
                    'Chỉ có thể gửi đề xuất gia hạn cho kỳ thuê đã được xác nhận hoặc đang hoạt động.',
                );

                abort_unless(
                    $tenancy->pending_contract_id === null
                        && $tenancy->confirmation_expires_at === null,
                    409,
                    'Kỳ thuê đang có một đề xuất khác cần được xử lý trước.',
                );

                abort_if($property->archived_at !== null || $unit->archived_at !== null, 409,
                    'Không thể đề xuất gia hạn cho bất động sản hoặc căn đã lưu trữ.');

                $renewalRequest = DB::table('tenancy_renewal_requests')
                    ->where('id', $renewalRequestId)
                    ->where('tenancy_id', $tenancyId)
                    ->lockForUpdate()
                    ->first();

                abort_if($renewalRequest === null, 404);
                abort_unless($renewalRequest->status === 'PENDING', 409,
                    'Đề nghị gia hạn này không còn chờ xử lý.');

                abort_if(
                    DB::table('tenancy_contracts')
                        ->where('tenancy_id', $tenancyId)
                        ->where('renewal_request_id', $renewalRequestId)
                        ->exists(),
                    409,
                    'Đề nghị này đã có phiên bản gia hạn; hãy dùng luồng điều chỉnh phiên bản.',
                );

                $basisContract = DB::table('tenancy_contracts')
                    ->where('tenancy_id', $tenancyId)
                    ->where('id', $tenancy->latest_confirmed_contract_id)
                    ->lockForUpdate()
                    ->first();

                abort_unless(
                    $basisContract !== null
                        && $basisContract->tenant_confirmed_at !== null
                        && $basisContract->tenant_rejected_at === null
                        && $basisContract->end_date === $tenancy->confirmed_end_date,
                    409,
                    'Không tìm thấy thỏa thuận hiện tại hợp lệ làm căn cứ gia hạn.',
                );

                if ($attributes['policies_snapshot'] === [] || array_is_list($attributes['policies_snapshot'])) {
                    throw ValidationException::withMessages([
                        'policies_snapshot' => 'Vui lòng cung cấp chính sách gia hạn dưới dạng đối tượng.',
                    ]);
                }

                $startDate = CarbonImmutable::parse($tenancy->confirmed_end_date)->addDay();
                $endDate = CarbonImmutable::parse($attributes['end_date']);
                if ($endDate->lessThanOrEqualTo(CarbonImmutable::parse($tenancy->confirmed_end_date))) {
                    throw ValidationException::withMessages([
                        'end_date' => 'Ngày kết thúc gia hạn phải sau ngày kết thúc hiện tại.',
                    ]);
                }

                $latestVersion = (int) DB::table('tenancy_contracts')
                    ->where('tenancy_id', $tenancyId)
                    ->max('version_number');
                $versionNumber = $latestVersion + 1;
                $now = now();
                $expiresAt = $now->copy()->addHours(max(
                    1,
                    (int) config('services.supabase.contracts.confirmation_hours', 48),
                ));

                DB::select(
                    'SELECT set_config(?, ?, true)',
                    ['rentos.actor_id', $owner->id],
                );

                DB::table('tenancy_contracts')->insert([
                    'id' => $contractId,
                    'tenancy_id' => $tenancyId,
                    'version_number' => $versionNumber,
                    'type' => 'RENEWAL',
                    'renewal_request_id' => $renewalRequestId,
                    'basis_contract_id' => $basisContract->id,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'monthly_rent' => $attributes['monthly_rent'],
                    'deposit_amount' => $attributes['deposit_amount'],
                    'policies_snapshot' => json_encode(
                        (object) $attributes['policies_snapshot'],
                        JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
                    ),
                    'document_path' => null,
                    'document_sha256' => null,
                    'created_by' => $owner->id,
                    'owner_confirmed_at' => $now,
                    'created_at' => $now,
                ]);

                DB::table('tenancies')
                    ->where('id', $tenancyId)
                    ->update([
                        'blocked_end_date' => $endDate->toDateString(),
                        'pending_contract_id' => $contractId,
                        'confirmation_expires_at' => $expiresAt,
                        'updated_at' => $now,
                    ]);

                DB::table('audit_logs')->insert([
                    'id' => (string) Str::uuid(),
                    'actor_id' => $owner->id,
                    'entity_type' => 'tenancy',
                    'entity_id' => $tenancyId,
                    'action' => self::ACTION,
                    'before_values' => json_encode([
                        'renewal_request_status' => $renewalRequest->status,
                        'confirmed_end_date' => $tenancy->confirmed_end_date,
                        'blocked_end_date' => $tenancy->blocked_end_date,
                        'pending_contract_id' => null,
                    ], JSON_THROW_ON_ERROR),
                    'after_values' => json_encode([
                        'renewal_request_id' => $renewalRequestId,
                        'contract_id' => $contractId,
                        'version_number' => $versionNumber,
                        'type' => 'RENEWAL',
                        'start_date' => $startDate->toDateString(),
                        'end_date' => $endDate->toDateString(),
                        'monthly_rent' => $attributes['monthly_rent'],
                        'deposit_amount' => $attributes['deposit_amount'],
                        'confirmation_expires_at' => $expiresAt->toISOString(),
                    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                    'reason' => null,
                    'correlation_id' => $operationId,
                    'created_at' => $now,
                ]);

                app(RecordNotification::class)->record(
                    recipientId: $tenancy->tenant_id,
                    audience: 'TENANT',
                    eventKey: self::ACTION.':'.$contractId,
                    title: 'Chủ nhà đã gửi đề xuất gia hạn',
                    body: 'Vui lòng xem lại thời hạn và các điều khoản của kỳ gia hạn.',
                    resourceType: 'tenancy',
                    resourceId: $tenancyId,
                    actorId: $owner->id,
                    sendEmail: true,
                );

                DB::table('idempotency_records')->insert([
                    'id' => (string) Str::uuid(),
                    'actor_id' => $owner->id,
                    'action' => self::ACTION,
                    'client_operation_id' => $operationId,
                    'request_hash' => $requestHash,
                    'result_resource_type' => 'tenancy',
                    'result_ids' => '{'.$tenancyId.','.$contractId.'}',
                    'response_status' => 201,
                    'created_at' => $now,
                ]);

                return $this->result($tenancyId, $contractId, false);
            });
        } catch (QueryException $exception) {
            if (($exception->errorInfo[0] ?? null) === '23P01') {
                abort(409, 'Khoảng thời gian gia hạn bị trùng với một kỳ thuê khác.');
            }

            throw $exception;
        }
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

    /**
     * @param  array<mixed>  $value
     * @return array<mixed>
     */
    private function canonicalize(array $value): array
    {
        if (array_is_list($value)) {
            return array_map(
                fn (mixed $item): mixed => is_array($item) ? $this->canonicalize($item) : $item,
                $value,
            );
        }

        ksort($value);

        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = $this->canonicalize($item);
            }
        }

        return $value;
    }
}
