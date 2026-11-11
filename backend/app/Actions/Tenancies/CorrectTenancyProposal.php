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

class CorrectTenancyProposal
{
    /**
     * @param array{
     *     client_operation_id: string,
     *     supersedes_contract_id: string,
     *     start_date: string,
     *     end_date: string,
     *     monthly_rent: int|string,
     *     deposit_amount: int|string,
     *     policies_snapshot: array<string, mixed>,
     *     signed_on?: string|null
     * } $input
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    public function handle(User $owner, string $tenancyId, array $input): array
    {
        $requestHash = hash(
            'sha256',
            json_encode(
                $this->canonicalize($input),
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
            ),
        );

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', $tenancyId)
            ->select('tenancies.unit_id', 'units.property_id')
            ->first();

        abort_if($context === null, 404);

        $contractId = (string) Str::uuid();
        try {
            return DB::transaction(function () use (
                $owner,
                $tenancyId,
                $input,
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

                abort_unless($property->owner_id === $owner->id, 404);
                abort_unless($tenancy->owner_id === $owner->id, 404);

                DB::select(
                    'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))',
                    [$owner->id.':tenancy.correct:'.$input['client_operation_id']],
                );

                $replay = DB::table('idempotency_records')
                    ->where('actor_id', $owner->id)
                    ->where('action', 'tenancy.correct')
                    ->where('client_operation_id', $input['client_operation_id'])
                    ->first();

                if ($replay !== null) {
                    abort_unless(hash_equals($replay->request_hash, $requestHash), 409);

                    $resultIds = explode(',', trim((string) $replay->result_ids, '{}'));
                    abort_unless(count($resultIds) === 2, 409);

                    return $this->result(
                        $resultIds[0],
                        $resultIds[1],
                        true,
                    );
                }

                abort_if($property->archived_at !== null, 409, 'This property is archived.');
                abort_if($unit->archived_at !== null, 409, 'This unit is archived.');
                abort_unless($unit->operational_status === 'READY', 409, 'The unit must be ready.');

                abort_unless(
                    $tenancy->status === 'AWAITING_REVISION'
                        && $tenancy->pending_contract_id === null
                        && $tenancy->confirmation_expires_at === null,
                    409,
                    'Only a declined proposal can be corrected.',
                );

                $previousContract = DB::table('tenancy_contracts')
                    ->where('tenancy_id', $tenancyId)
                    ->where('id', $input['supersedes_contract_id'])
                    ->lockForUpdate()
                    ->first();

                abort_if($previousContract === null, 409, 'The contract to correct was not found.');
                abort_unless($previousContract->type === 'ORIGINAL', 409);
                abort_unless(
                    $previousContract->tenant_rejected_at !== null
                        && $previousContract->tenant_confirmed_at === null,
                    409,
                    'Only a declined, unconfirmed contract can be corrected.',
                );

                $latestVersion = (int) DB::table('tenancy_contracts')
                    ->where('tenancy_id', $tenancyId)
                    ->max('version_number');

                abort_unless(
                    (int) $previousContract->version_number === $latestVersion,
                    409,
                    'Only the latest contract version can be corrected.',
                );

                $minimumMonths = max(3, (int) $unit->minimum_rental_months);
                $minimumEndDate = CarbonImmutable::parse($input['start_date'])
                    ->addMonthsNoOverflow($minimumMonths)
                    ->subDay();

                if (CarbonImmutable::parse($input['end_date'])->lessThan($minimumEndDate)) {
                    throw ValidationException::withMessages([
                        'end_date' => "The rental term must be at least {$minimumMonths} calendar months.",
                    ]);
                }

                if ($input['policies_snapshot'] === [] || array_is_list($input['policies_snapshot'])) {
                    throw ValidationException::withMessages([
                        'policies_snapshot' => 'Provide the agreed policy snapshot as an object.',
                    ]);
                }

                $now = now();
                $confirmationHours = max(
                    1,
                    (int) config('services.supabase.contracts.confirmation_hours', 48),
                );
                $expiresAt = $now->copy()->addHours($confirmationHours);
                $versionNumber = $latestVersion + 1;

                DB::table('tenancy_contracts')->insert([
                    'id' => $contractId,
                    'tenancy_id' => $tenancyId,
                    'version_number' => $versionNumber,
                    'type' => 'ORIGINAL',
                    'supersedes_contract_id' => $previousContract->id,
                    'start_date' => $input['start_date'],
                    'end_date' => $input['end_date'],
                    'monthly_rent' => (int) $input['monthly_rent'],
                    'deposit_amount' => (int) $input['deposit_amount'],
                    'policies_snapshot' => json_encode(
                        (object) $input['policies_snapshot'],
                        JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
                    ),
                    'document_path' => null,
                    'document_sha256' => null,
                    'signed_on' => $input['signed_on'] ?? null,
                    'created_by' => $owner->id,
                    'owner_confirmed_at' => $now,
                    'created_at' => $now,
                ]);

                DB::table('tenancies')
                    ->where('id', $tenancyId)
                    ->update([
                        'status' => 'PENDING_CONFIRMATION',
                        'blocked_start_date' => $input['start_date'],
                        'blocked_end_date' => $input['end_date'],
                        'pending_contract_id' => $contractId,
                        'confirmation_expires_at' => $expiresAt,
                        'updated_at' => $now,
                    ]);

                DB::table('audit_logs')->insert([
                    'id' => (string) Str::uuid(),
                    'actor_id' => $owner->id,
                    'entity_type' => 'tenancy',
                    'entity_id' => $tenancyId,
                    'action' => 'tenancy.contract.corrected',
                    'before_values' => json_encode([
                        'status' => $tenancy->status,
                        'supersedes_contract_id' => $previousContract->id,
                        'version_number' => $previousContract->version_number,
                    ], JSON_THROW_ON_ERROR),
                    'after_values' => json_encode([
                        'status' => 'PENDING_CONFIRMATION',
                        'contract_id' => $contractId,
                        'supersedes_contract_id' => $previousContract->id,
                        'version_number' => $versionNumber,
                        'confirmation_expires_at' => $expiresAt->toISOString(),
                    ], JSON_THROW_ON_ERROR),
                    'reason' => null,
                    'correlation_id' => $input['client_operation_id'],
                    'created_at' => $now,
                ]);

                app(RecordNotification::class)->record(
                    recipientId: $tenancy->tenant_id,
                    audience: 'TENANT',
                    eventKey: 'tenancy.contract.corrected:'.$contractId,
                    title: 'Đề xuất kỳ thuê đã được điều chỉnh',
                    body: 'Chủ nhà đã gửi phiên bản đề xuất cập nhật.',
                    resourceType: 'tenancy',
                    resourceId: $tenancyId,
                    actorId: $owner->id,
                    sendEmail: true,
                );

                DB::table('idempotency_records')->insert([
                    'id' => (string) Str::uuid(),
                    'actor_id' => $owner->id,
                    'action' => 'tenancy.correct',
                    'client_operation_id' => $input['client_operation_id'],
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
                abort(409, 'The selected unit is no longer available for those dates.');
            }

            throw $exception;
        }
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
