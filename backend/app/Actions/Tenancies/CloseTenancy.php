<?php

namespace App\Actions\Tenancies;

use App\Models\Property;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CloseTenancy
{
    /**
     * @param  'cancel'|'end'  $transition
     * @param  array{client_operation_id: string, reason: string}  $input
     * @return array{tenancy: object, replayed: bool}
     */
    public function handle(
        User $owner,
        string $tenancyId,
        string $transition,
        array $input,
    ): array {
        abort_unless(in_array($transition, ['cancel', 'end'], true), 400);

        $reason = trim($input['reason']);
        $action = $transition === 'cancel' ? 'tenancy.cancel' : 'tenancy.end';
        $newStatus = $transition === 'cancel' ? 'CANCELLED' : 'ENDED';

        $requestHash = hash('sha256', json_encode([
            'tenancy_id' => $tenancyId,
            'transition' => $transition,
            'reason' => $reason,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->where('tenancies.id', $tenancyId)
            ->select('tenancies.unit_id', 'units.property_id')
            ->first();

        abort_if($context === null, 404);

        return DB::transaction(function () use (
            $owner,
            $tenancyId,
            $transition,
            $input,
            $reason,
            $action,
            $newStatus,
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
                [$owner->id.':'.$action.':'.$input['client_operation_id']],
            );

            $replay = DB::table('idempotency_records')
                ->where('actor_id', $owner->id)
                ->where('action', $action)
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

            if ($transition === 'cancel') {
                abort_unless(
                    $tenancy->status === 'CONFIRMED'
                        && $tenancy->moved_in_at === null
                        && $tenancy->confirmed_start_date !== null
                        && CarbonImmutable::parse($tenancy->confirmed_start_date)
                            ->isAfter(CarbonImmutable::today()),
                    409,
                    'Only a confirmed tenancy before its start date can be cancelled.',
                );
            } else {
                abort_unless(
                    $tenancy->status === 'ACTIVE'
                        && $tenancy->moved_in_at !== null,
                    409,
                    'Only an active tenancy can be ended.',
                );
            }

            $pendingRenewals = DB::table('tenancy_renewal_requests')
                ->where('tenancy_id', $tenancyId)
                ->where('status', 'PENDING')
                ->lockForUpdate()
                ->get();

            $now = now();

            foreach ($pendingRenewals as $renewal) {
                DB::table('tenancy_renewal_requests')
                    ->where('id', $renewal->id)
                    ->update([
                        'status' => 'CANCELLED',
                        'reviewed_by' => $owner->id,
                        'reviewed_at' => $now,
                        'review_reason' => $reason,
                        'updated_at' => $now,
                    ]);

                DB::table('audit_logs')->insert([
                    'id' => (string) Str::uuid(),
                    'actor_id' => $owner->id,
                    'entity_type' => 'tenancy_renewal_request',
                    'entity_id' => $renewal->id,
                    'action' => 'tenancy.renewal.cancelled_by_tenancy_close',
                    'before_values' => json_encode([
                        'status' => 'PENDING',
                    ], JSON_THROW_ON_ERROR),
                    'after_values' => json_encode([
                        'status' => 'CANCELLED',
                        'tenancy_id' => $tenancyId,
                        'reason' => $reason,
                    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                    'reason' => $reason,
                    'correlation_id' => $input['client_operation_id'],
                    'created_at' => $now,
                ]);
            }

            DB::table('tenancies')
                ->where('id', $tenancyId)
                ->update([
                    'status' => $newStatus,
                    'actual_ended_at' => $now,
                    'end_reason' => $reason,
                    'blocked_start_date' => null,
                    'blocked_end_date' => null,
                    'pending_contract_id' => null,
                    'confirmation_expires_at' => null,
                    'updated_at' => $now,
                ]);

            DB::table('audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $owner->id,
                'entity_type' => 'tenancy',
                'entity_id' => $tenancyId,
                'action' => 'tenancy.'.($transition === 'cancel' ? 'cancelled' : 'ended'),
                'before_values' => json_encode([
                    'status' => $tenancy->status,
                    'blocked_start_date' => $tenancy->blocked_start_date,
                    'blocked_end_date' => $tenancy->blocked_end_date,
                    'pending_contract_id' => $tenancy->pending_contract_id,
                ], JSON_THROW_ON_ERROR),
                'after_values' => json_encode([
                    'status' => $newStatus,
                    'actual_ended_at' => $now->toISOString(),
                    'reason' => $reason,
                ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'reason' => $reason,
                'correlation_id' => $input['client_operation_id'],
                'created_at' => $now,
            ]);

            DB::table('notification_outbox')->insert([
                'id' => (string) Str::uuid(),
                'event_key' => 'tenancy.'.($transition === 'cancel' ? 'cancelled' : 'ended').':'.$tenancyId,
                'recipient_id' => $tenancy->tenant_id,
                'event_type' => 'tenancy.'.($transition === 'cancel' ? 'cancelled' : 'ended'),
                'payload' => json_encode([
                    'tenancy_id' => $tenancyId,
                    'status' => $newStatus,
                    'actual_ended_at' => $now->toISOString(),
                    'reason' => $reason,
                ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $owner->id,
                'action' => $action,
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
