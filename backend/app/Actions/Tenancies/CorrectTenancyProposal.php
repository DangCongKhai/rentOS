<?php

namespace App\Actions\Tenancies;

use App\Domain\Tenancies\ContractDocumentStorage;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class CorrectTenancyProposal
{
    public function __construct(
        private ContractDocumentStorage $documents,
    ) {}

    /**
     * @param array{
     *     client_operation_id: string,
     *     supersedes_contract_id: string,
     *     start_date: string,
     *     end_date: string,
     *     monthly_rent: int|string,
     *     deposit_amount: int|string,
     *     policies_snapshot: array<string, mixed>,
     *     agreement_document: UploadedFile,
     *     signed_on?: string|null
     * } $input
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    public function handle(User $owner, string $tenancyId, array $input): array
    {
        $fileHash = hash_file(
            'sha256',
            $input['agreement_document']->getRealPath(),
        );

        if ($fileHash === false) {
            throw new \RuntimeException('Could not read the agreement document.');
        }

        $hashInput = $input;
        unset($hashInput['agreement_document']);
        $hashInput['document_sha256'] = $fileHash;

        $requestHash = hash(
            'sha256',
            json_encode(
                $this->canonicalize($hashInput),
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
        $storedPath = null;

        try {
            return DB::transaction(function () use (
                $owner,
                $tenancyId,
                $input,
                $requestHash,
                $contractId,
                $context,
                &$storedPath,
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

                $document = $this->documents->upload(
                    $input['agreement_document'],
                    $tenancyId,
                    $contractId,
                );
                $storedPath = $document['path'];

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
                    'document_path' => $document['path'],
                    'document_sha256' => $document['sha256'],
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
                        'document_sha256' => $document['sha256'],
                        'confirmation_expires_at' => $expiresAt->toISOString(),
                    ], JSON_THROW_ON_ERROR),
                    'reason' => null,
                    'correlation_id' => $input['client_operation_id'],
                    'created_at' => $now,
                ]);

                DB::table('notification_outbox')->insert([
                    'id' => (string) Str::uuid(),
                    'event_key' => 'tenancy.contract.corrected:'.$contractId,
                    'recipient_id' => $tenancy->tenant_id,
                    'event_type' => 'tenancy.contract.corrected',
                    'payload' => json_encode([
                        'tenancy_id' => $tenancyId,
                        'contract_id' => $contractId,
                        'supersedes_contract_id' => $previousContract->id,
                        'confirmation_expires_at' => $expiresAt->toISOString(),
                    ], JSON_THROW_ON_ERROR),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

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
        } catch (Throwable $exception) {
            if ($storedPath !== null) {
                $this->documents->delete($storedPath);
            }

            if (
                $exception instanceof QueryException
                && ($exception->errorInfo[0] ?? null) === '23P01'
            ) {
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
