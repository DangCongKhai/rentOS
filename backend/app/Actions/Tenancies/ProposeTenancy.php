<?php

namespace App\Actions\Tenancies;

use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProposeTenancy
{
    /**
     * @param array{
     *     client_operation_id: string,
     *     unit_id: string,
     *     start_date: string,
     *     end_date: string,
     *     monthly_rent: int|string,
     *     deposit_amount: int|string,
     *     policies_snapshot: array<string, mixed>,
     *     signed_on?: string|null
     * } $data
     * @return array{tenancy: object, contract: object, replayed: bool}
     */
    public function handle(User $owner, string $rentalRequestId, array $data): array
    {
        $requestHash = hash(
            'sha256',
            json_encode($this->canonicalize($data), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
        );

        $context = DB::table('rental_requests as requests')
            ->join('listings', 'listings.id', '=', 'requests.listing_id')
            ->where('requests.id', $rentalRequestId)
            ->select('listings.property_id')
            ->first();

        abort_if($context === null, 404);

        $tenancyId = (string) Str::uuid();
        $contractId = (string) Str::uuid();

        try {
            return DB::transaction(function () use (
                $owner,
                $rentalRequestId,
                $data,
                $requestHash,
                $tenancyId,
                $contractId,
                $context,
            ): array {
                $property = Property::query()
                    ->whereKey($context->property_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                abort_unless($property->owner_id === $owner->id, 403);
                abort_if($property->archived_at !== null, 409, 'This property is archived.');

                $unit = Unit::query()
                    ->whereKey($data['unit_id'])
                    ->where('property_id', $property->id)
                    ->lockForUpdate()
                    ->first();

                abort_if($unit === null, 422, 'Choose a unit in this property.');
                abort_if($unit->archived_at !== null, 409, 'This unit is archived.');
                abort_unless($unit->operational_status === 'READY', 409, 'The unit must be ready.');

                $rentalRequest = DB::table('rental_requests')
                    ->where('id', $rentalRequestId)
                    ->lockForUpdate()
                    ->first();

                abort_if($rentalRequest === null, 404);

                $listing = DB::table('listings')
                    ->where('id', $rentalRequest->listing_id)
                    ->first();

                abort_if(
                    $listing === null || $listing->property_id !== $property->id,
                    409,
                    'The rental request does not belong to this property.',
                );

                $existing = DB::table('idempotency_records')
                    ->where('actor_id', $owner->id)
                    ->where('action', 'tenancy.propose')
                    ->where('client_operation_id', $data['client_operation_id'])
                    ->first();

                if ($existing !== null) {
                    abort_unless(hash_equals($existing->request_hash, $requestHash), 409);

                    $tenancy = DB::table('tenancies')
                        ->where('owner_id', $owner->id)
                        ->where('client_operation_id', $data['client_operation_id'])
                        ->firstOrFail();

                    return $this->result($tenancy->id, true);
                }

                abort_unless(
                    $rentalRequest->status === 'PENDING' && $rentalRequest->closed_at === null,
                    409,
                    'This rental request is no longer pending.',
                );

                abort_if(
                    DB::table('tenancies')
                        ->where('rental_request_id', $rentalRequestId)
                        ->exists(),
                    409,
                    'This rental request already has a tenancy proposal.',
                );

                $minimumMonths = max(3, (int) $unit->minimum_rental_months);
                $minimumEndDate = CarbonImmutable::parse($data['start_date'])
                    ->addMonthsNoOverflow($minimumMonths)
                    ->subDay();

                if (CarbonImmutable::parse($data['end_date'])->lessThan($minimumEndDate)) {
                    throw ValidationException::withMessages([
                        'end_date' => "The rental term must be at least {$minimumMonths} calendar months.",
                    ]);
                }

                if ($data['policies_snapshot'] === [] || array_is_list($data['policies_snapshot'])) {
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

                DB::table('tenancies')->insert([
                    'id' => $tenancyId,
                    'unit_id' => $unit->id,
                    'tenant_id' => $rentalRequest->tenant_id,
                    'owner_id' => $owner->id,
                    'rental_request_id' => $rentalRequestId,
                    'client_operation_id' => $data['client_operation_id'],
                    'status' => 'PENDING_CONFIRMATION',
                    'blocked_start_date' => $data['start_date'],
                    'blocked_end_date' => $data['end_date'],
                    'pending_contract_id' => $contractId,
                    'confirmation_expires_at' => $expiresAt,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('tenancy_contracts')->insert([
                    'id' => $contractId,
                    'tenancy_id' => $tenancyId,
                    'version_number' => 1,
                    'type' => 'ORIGINAL',
                    'start_date' => $data['start_date'],
                    'end_date' => $data['end_date'],
                    'monthly_rent' => (int) $data['monthly_rent'],
                    'deposit_amount' => (int) $data['deposit_amount'],
                    'policies_snapshot' => json_encode(
                        (object) $data['policies_snapshot'],
                        JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
                    ),
                    'document_path' => null,
                    'document_sha256' => null,
                    'signed_on' => $data['signed_on'] ?? null,
                    'created_by' => $owner->id,
                    'owner_confirmed_at' => $now,
                    'created_at' => $now,
                ]);

                DB::table('rental_requests')
                    ->where('id', $rentalRequestId)
                    ->update([
                        'status' => 'ACCEPTED',
                        'closed_at' => $now,
                        'updated_at' => $now,
                    ]);

                DB::table('audit_logs')->insert([
                    [
                        'id' => (string) Str::uuid(),
                        'actor_id' => $owner->id,
                        'entity_type' => 'tenancy',
                        'entity_id' => $tenancyId,
                        'action' => 'tenancy.proposed',
                        'before_values' => null,
                        'after_values' => json_encode([
                            'contract_id' => $contractId,
                            'version_number' => 1,
                            'status' => 'PENDING_CONFIRMATION',
                            'rental_request_id' => $rentalRequestId,
                            'unit_id' => $unit->id,
                        ], JSON_THROW_ON_ERROR),
                        'reason' => null,
                        'correlation_id' => $data['client_operation_id'],
                        'created_at' => $now,
                    ],
                    [
                        'id' => (string) Str::uuid(),
                        'actor_id' => $owner->id,
                        'entity_type' => 'rental_request',
                        'entity_id' => $rentalRequestId,
                        'action' => 'rental_request.accepted',
                        'before_values' => json_encode(['status' => 'PENDING'], JSON_THROW_ON_ERROR),
                        'after_values' => json_encode(['status' => 'ACCEPTED'], JSON_THROW_ON_ERROR),
                        'reason' => null,
                        'correlation_id' => $data['client_operation_id'],
                        'created_at' => $now,
                    ],
                ]);

                DB::table('notification_outbox')->insert([
                    'id' => (string) Str::uuid(),
                    'event_key' => "tenancy.proposed:{$contractId}",
                    'recipient_id' => $rentalRequest->tenant_id,
                    'event_type' => 'tenancy.proposed',
                    'payload' => json_encode([
                        'tenancy_id' => $tenancyId,
                        'contract_id' => $contractId,
                        'confirmation_expires_at' => $expiresAt->toISOString(),
                    ], JSON_THROW_ON_ERROR),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('idempotency_records')->insert([
                    'id' => (string) Str::uuid(),
                    'actor_id' => $owner->id,
                    'action' => 'tenancy.propose',
                    'client_operation_id' => $data['client_operation_id'],
                    'request_hash' => $requestHash,
                    'result_resource_type' => 'tenancy',
                    'result_ids' => '{'.$tenancyId.'}',
                    'response_status' => 201,
                    'created_at' => $now,
                ]);

                return $this->result($tenancyId, false);
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
    private function result(string $tenancyId, bool $replayed): array
    {
        return [
            'tenancy' => DB::table('tenancies')->where('id', $tenancyId)->firstOrFail(),
            'contract' => DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('version_number', 1)
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
