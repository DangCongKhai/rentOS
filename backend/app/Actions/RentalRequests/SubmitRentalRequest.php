<?php

namespace App\Actions\RentalRequests;

use App\Models\Listing;
use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SubmitRentalRequest
{
    private const string EVENT = 'rental_request.submitted';

    /**
     * @param  array{listing_id: string, client_operation_id: string, contact_name: string, contact_phone: string, desired_move_in_date: string, desired_end_date: string, preferred_unit_id?: string|null, message?: string|null}  $input
     * @return array{id: string, status: string, created: bool}
     */
    public function handle(User $actor, array $input): array
    {
        $operationId = $input['client_operation_id'];
        $attributes = [
            'listing_id' => $input['listing_id'],
            'contact_name' => $input['contact_name'],
            'contact_phone' => $input['contact_phone'],
            'desired_move_in_date' => $input['desired_move_in_date'],
            'desired_end_date' => $input['desired_end_date'],
            'preferred_unit_id' => $input['preferred_unit_id'] ?? null,
            'message' => $input['message'] ?? '',
        ];
        $hash = hash('sha256', json_encode($attributes, JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($actor, $operationId, $attributes, $hash): array {
            $tenant = User::query()->lockForUpdate()->findOrFail($actor->id);
            Gate::forUser($tenant)->authorize('submitRentalRequest', Listing::class);

            $replay = DB::table('idempotency_records')
                ->where('actor_id', $tenant->id)
                ->where('action', self::EVENT)
                ->where('client_operation_id', $operationId)
                ->first();
            if ($replay !== null) {
                abort_unless(hash_equals($replay->request_hash, $hash), 409, 'Mã thao tác đã được dùng cho nội dung khác.');
                $existing = DB::table('rental_requests')->where('tenant_id', $tenant->id)
                    ->where('client_operation_id', $operationId)->firstOrFail();

                return ['id' => $existing->id, 'status' => $existing->status, 'created' => false];
            }

            $propertyId = Listing::query()->whereKey($attributes['listing_id'])->value('property_id');
            $property = $propertyId === null ? null : Property::query()->lockForUpdate()->find($propertyId);
            if ($property === null || ! Listing::query()->publiclyVisible()
                ->whereKey($attributes['listing_id'])->where('property_id', $property->id)->lockForUpdate()->first()) {
                throw ValidationException::withMessages(['listing_id' => 'Tin đăng hiện không nhận yêu cầu thuê.']);
            }
            if ($property->owner_id === $tenant->id) {
                throw ValidationException::withMessages(['listing_id' => 'Bạn không thể gửi yêu cầu thuê cho tin của mình.']);
            }

            $unitId = $attributes['preferred_unit_id'];
            $minimumMonths = $this->minimumRentalMonths($property, $unitId);
            $this->assertMinimumStay(
                $attributes['desired_move_in_date'],
                $attributes['desired_end_date'],
                $minimumMonths,
            );

            $id = (string) Str::uuid();
            $inserted = DB::table('rental_requests')->insertOrIgnore([
                ...$attributes,
                'id' => $id,
                'tenant_id' => $tenant->id,
                'client_operation_id' => $operationId,
                'status' => 'PENDING',
            ]);
            abort_unless($inserted === 1, 409, 'Bạn đã có yêu cầu đang chờ cho tin đăng này.');

            DB::table('audit_logs')->insert([
                'actor_id' => $tenant->id,
                'entity_type' => 'rental_request',
                'entity_id' => $id,
                'action' => self::EVENT,
                'after_values' => json_encode(['status' => 'PENDING'], JSON_THROW_ON_ERROR),
                'correlation_id' => $operationId,
            ]);
            DB::table('notification_outbox')->insert([
                'event_key' => self::EVENT.':'.$id,
                'recipient_id' => $property->owner_id,
                'event_type' => self::EVENT,
                'payload' => json_encode(['rental_request_id' => $id, 'listing_id' => $attributes['listing_id']], JSON_THROW_ON_ERROR),
            ]);
            DB::table('idempotency_records')->insert([
                'actor_id' => $tenant->id,
                'action' => self::EVENT,
                'client_operation_id' => $operationId,
                'request_hash' => $hash,
                'result_resource_type' => 'rental_request',
                'result_ids' => '{'.$id.'}',
                'response_status' => 201,
            ]);

            return ['id' => $id, 'status' => 'PENDING', 'created' => true];
        }, 3);
    }

    private function minimumRentalMonths(Property $property, ?string $unitId): int
    {
        $eligible = $property->units()
            ->whereNull('archived_at')
            ->where('is_marketed', true)
            ->where('operational_status', 'READY');

        if ($unitId !== null) {
            $unit = $eligible->whereKey($unitId)->lockForUpdate()->first();
            if (! $unit instanceof Unit) {
                throw ValidationException::withMessages([
                    'preferred_unit_id' => 'Căn ưu tiên không hợp lệ cho tin đăng này.',
                ]);
            }

            return (int) $unit->minimum_rental_months;
        }

        return (int) $eligible->min('minimum_rental_months');
    }

    private function assertMinimumStay(string $start, string $end, int $months): void
    {
        if ($months < 1) {
            return;
        }

        $earliest = CarbonImmutable::parse($start)->addMonthsNoOverflow($months)->subDay();
        if (CarbonImmutable::parse($end)->lt($earliest)) {
            throw ValidationException::withMessages([
                'desired_end_date' => "Thời gian thuê phải ít nhất {$months} tháng.",
            ]);
        }
    }
}
