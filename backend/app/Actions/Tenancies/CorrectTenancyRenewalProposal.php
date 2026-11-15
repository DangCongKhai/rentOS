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

class CorrectTenancyRenewalProposal
{
    private const string ACTION = 'tenancy.renewal.corrected';

    /**
     * @param  array{client_operation_id: string, supersedes_contract_id: string, end_date: string, monthly_rent: int|string, deposit_amount: int|string, policies_snapshot: array<string, mixed>}  $input
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    public function handle(
        User $owner,
        string $tenancyId,
        string $renewalRequestId,
        array $input,
    ): array {
        $tenancyId = strtolower($tenancyId);
        $renewalRequestId = strtolower($renewalRequestId);
        $operationId = strtolower($input['client_operation_id']);
        $supersedesContractId = strtolower($input['supersedes_contract_id']);
        $attributes = [
            'end_date' => $input['end_date'],
            'monthly_rent' => (int) $input['monthly_rent'],
            'deposit_amount' => (int) $input['deposit_amount'],
            'policies_snapshot' => $this->canonicalize($input['policies_snapshot']),
        ];
        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => $tenancyId,
            'renewal_request_id' => $renewalRequestId,
            'supersedes_contract_id' => $supersedesContractId,
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
                $supersedesContractId,
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
                    abort_unless(
                        hash_equals($replay->request_hash, $requestHash),
                        409,
                        'Mã thao tác đã được dùng cho nội dung khác.',
                    );

                    $resultIds = explode(',', trim((string) $replay->result_ids, '{}'));
                    abort_unless(count($resultIds) === 2, 409);

                    return $this->result($resultIds[0], $resultIds[1], true);
                }

                abort_if($property->archived_at !== null || $unit->archived_at !== null, 409,
                    'Không thể điều chỉnh đề xuất cho bất động sản hoặc căn đã lưu trữ.');

                abort_unless(
                    in_array($tenancy->status, ['CONFIRMED', 'ACTIVE'], true)
                        && $tenancy->confirmed_start_date !== null
                        && $tenancy->confirmed_end_date !== null
                        && $tenancy->latest_confirmed_contract_id !== null
                        && $tenancy->blocked_start_date === $tenancy->confirmed_start_date
                        && $tenancy->blocked_end_date === $tenancy->confirmed_end_date
                        && $tenancy->pending_contract_id === null
                        && $tenancy->confirmation_expires_at === null,
                    409,
                    'Chỉ có thể điều chỉnh đề xuất khi kỳ thuê hiện tại không có phiên bản chờ xác nhận.',
                );

                $renewalRequest = DB::table('tenancy_renewal_requests')
                    ->where('id', $renewalRequestId)
                    ->where('tenancy_id', $tenancyId)
                    ->lockForUpdate()
                    ->first();

                abort_unless(
                    $renewalRequest !== null && $renewalRequest->status === 'PENDING',
                    409,
                    'Đề nghị gia hạn không còn chờ xử lý.',
                );

                $previousContract = DB::table('tenancy_contracts')
                    ->where('tenancy_id', $tenancyId)
                    ->where('id', $supersedesContractId)
                    ->lockForUpdate()
                    ->first();

                $previousWasExpired = $previousContract !== null
                    && DB::table('audit_logs')
                        ->where('entity_type', 'tenancy_renewal_request')
                        ->where('entity_id', $renewalRequestId)
                        ->where('action', 'tenancy.renewal.proposal.expired')
                        ->where('correlation_id', $previousContract->id)
                        ->exists();

                abort_unless(
                    $previousContract !== null
                        && $previousContract->type === 'RENEWAL'
                        && $previousContract->renewal_request_id === $renewalRequestId
                        && $previousContract->basis_contract_id === $tenancy->latest_confirmed_contract_id
                        && $previousContract->owner_confirmed_at !== null
                        && ($previousContract->tenant_rejected_at !== null || $previousWasExpired)
                        && $previousContract->tenant_confirmed_at === null,
                    409,
                    'Chỉ có thể điều chỉnh phiên bản gia hạn gần nhất mà người thuê đã từ chối hoặc đã hết hạn.',
                );

                $latestVersion = (int) DB::table('tenancy_contracts')
                    ->where('tenancy_id', $tenancyId)
                    ->max('version_number');

                abort_unless(
                    (int) $previousContract->version_number === $latestVersion,
                    409,
                    'Chỉ có thể điều chỉnh phiên bản gia hạn mới nhất.',
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

                $confirmedEndDate = CarbonImmutable::parse($tenancy->confirmed_end_date);
                $startDate = $confirmedEndDate->addDay();
                $endDate = CarbonImmutable::parse($attributes['end_date']);

                if ($endDate->lessThanOrEqualTo($confirmedEndDate)) {
                    throw ValidationException::withMessages([
                        'end_date' => 'Ngày kết thúc gia hạn phải sau ngày kết thúc hiện tại.',
                    ]);
                }

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
                    'supersedes_contract_id' => $previousContract->id,
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
                    'entity_type' => 'tenancy_renewal_request',
                    'entity_id' => $renewalRequestId,
                    'action' => self::ACTION,
                    'before_values' => json_encode([
                        'status' => $renewalRequest->status,
                        'pending_contract_id' => null,
                        'blocked_end_date' => $tenancy->blocked_end_date,
                        'supersedes_contract_id' => $previousContract->id,
                        'previous_version_number' => $previousContract->version_number,
                    ], JSON_THROW_ON_ERROR),
                    'after_values' => json_encode([
                        'status' => 'PENDING',
                        'contract_id' => $contractId,
                        'version_number' => $versionNumber,
                        'basis_contract_id' => $basisContract->id,
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
                    title: 'Chủ nhà đã gửi phiên bản gia hạn mới',
                    body: 'Vui lòng xem lại các điều khoản cập nhật của kỳ gia hạn.',
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
