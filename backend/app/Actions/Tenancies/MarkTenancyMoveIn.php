<?php

namespace App\Actions\Tenancies;

use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MarkTenancyMoveIn
{
    /**
     * @param array{client_operation_id: string} $input
     * @return array{tenancy: object, replayed: bool}
     */
    public function handle(User $owner, string $tenancyId, array $input): array
    {
        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => $tenancyId,
        ], JSON_THROW_ON_ERROR));

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', $tenancyId)
            ->select('tenancies.unit_id', 'units.property_id')
            ->first();

        abort_if($context === null, 404);

        return DB::transaction(function () use (
            $owner,
            $tenancyId,
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

            abort_unless($tenancy->owner_id === $owner->id, 404);

            DB::select(
                'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))',
                [$owner->id.':tenancy.move_in:'.$input['client_operation_id']],
            );

            $replay = DB::table('idempotency_records')
                ->where('actor_id', $owner->id)
                ->where('action', 'tenancy.move_in')
                ->where('client_operation_id', $input['client_operation_id'])
                ->first();

            if ($replay !== null) {
                abort_unless(hash_equals($replay->request_hash, $requestHash), 409);

                return [
                    'tenancy' => DB::table('tenancies')
                        ->where('id', $tenancyId)
                        ->firstOrFail(),
                    'replayed' => true,
                ];
            }

            abort_unless(
                $tenancy->status === 'CONFIRMED'
                    && $tenancy->moved_in_at === null
                    && $tenancy->confirmed_start_date !== null,
                409,
                'Only a confirmed tenancy awaiting move-in can be activated.',
            );

            abort_unless(
                ! CarbonImmutable::parse($tenancy->confirmed_start_date)
                    ->isAfter(CarbonImmutable::today()),
                409,
                'Move-in cannot be recorded before the confirmed start date.',
            );

            $confirmedContract = DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancyId)
                ->where('id', $tenancy->latest_confirmed_contract_id)
                ->first();

            abort_unless(
                $confirmedContract !== null
                    && $confirmedContract->tenant_confirmed_at !== null
                    && $confirmedContract->tenant_rejected_at === null,
                409,
                'The latest contract version is not mutually confirmed.',
            );

            $now = now();

            DB::table('tenancies')
                ->where('id', $tenancyId)
                ->update([
                    'status' => 'ACTIVE',
                    'moved_in_at' => $now,
                    'updated_at' => $now,
                ]);

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $owner->id,
                'entity_type' => 'tenancy',
                'entity_id' => $tenancyId,
                'action' => 'tenancy.moved_in',
                'before_values' => json_encode([
                    'status' => $tenancy->status,
                    'moved_in_at' => $tenancy->moved_in_at,
                ], JSON_THROW_ON_ERROR),
                'after_values' => json_encode([
                    'status' => 'ACTIVE',
                    'moved_in_at' => $now->toISOString(),
                    'contract_id' => $confirmedContract->id,
                ], JSON_THROW_ON_ERROR),
                'reason' => null,
                'correlation_id' => $input['client_operation_id'],
                'created_at' => $now,
            ]);

            DB::table('notification_outbox')->insert([
                'id' => (string) Str::uuid(),
                'event_key' => 'tenancy.moved_in:'.$tenancyId,
                'recipient_id' => $tenancy->tenant_id,
                'event_type' => 'tenancy.moved_in',
                'payload' => json_encode([
                    'tenancy_id' => $tenancyId,
                    'moved_in_at' => $now->toISOString(),
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $owner->id,
                'action' => 'tenancy.move_in',
                'client_operation_id' => $input['client_operation_id'],
                'request_hash' => $requestHash,
                'result_resource_type' => 'tenancy',
                'result_ids' => '{'.$tenancyId.'}',
                'response_status' => 200,
                'created_at' => $now,
            ]);

            return [
                'tenancy' => DB::table('tenancies')
                    ->where('id', $tenancyId)
                    ->firstOrFail(),
                'replayed' => false,
            ];
        }, 3);
    }
}