<?php

namespace Database\Seeders;

use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use LogicException;
use RuntimeException;

/**
 * Local browser fixture for the tenant-to-owner RNT-09 renewal workflow.
 * Run: php artisan db:seed --class="Database\Seeders\Rnt09RenewalFlowSeeder" --no-interaction
 * Accounts: owner1@rentos.test / password and tenant1@example.com / password.
 */
class Rnt09RenewalFlowSeeder extends Seeder
{
    private const string FIXTURE_KEY = 'RNT-09-local-renewal-flow-v1';

    public function run(): void
    {
        $connection = config('database.connections.'.config('database.default'));
        $host = is_array($connection) ? ($connection['host'] ?? null) : null;
        $database = is_array($connection) ? ($connection['database'] ?? null) : null;

        if (
            ! app()->environment(['local', 'testing'])
            || ! in_array($host, ['localhost', '127.0.0.1', 'rentos-rnt04-db', 'db'], true)
            || ! in_array($database, ['postgres', 'rentos_dev', 'rentos_test'], true)
        ) {
            throw new LogicException('The RNT-09 demo fixture can only run against an isolated local PostgreSQL database.');
        }

        $owner = DB::table('users')->where('email', 'owner1@rentos.test')->first();
        $tenant = DB::table('users')->where('email', 'tenant1@example.com')->first();

        if ($owner === null || $tenant === null) {
            throw new RuntimeException('Baseline accounts were not found. Run BaselineSeeder first.');
        }

        $existing = DB::table('tenancies')
            ->where('client_operation_id', $this->id(1))
            ->first();

        if ($existing !== null) {
            $this->report($existing->id);

            return;
        }

        $listing = DB::table('listings')
            ->join('properties', 'properties.id', '=', 'listings.property_id')
            ->where('listings.id', BaselineSeeder::PUBLISHED_LISTING_ID)
            ->where('properties.owner_id', $owner->id)
            ->where('listings.moderation_status', 'APPROVED')
            ->where('listings.publication_status', 'PUBLISHED')
            ->whereNull('listings.archived_at')
            ->whereNull('listings.admin_suspended_at')
            ->select('listings.id as listing_id', 'listings.property_id')
            ->first();

        if ($listing === null) {
            throw new RuntimeException('The baseline owner’s approved, published listing was not found. Run BaselineSeeder first.');
        }

        $unit = DB::table('units')
            ->where('property_id', $listing->property_id)
            ->where('operational_status', 'READY')
            ->where('is_marketed', true)
            ->whereNull('archived_at')
            ->whereNotExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('tenancies')
                    ->whereColumn('tenancies.unit_id', 'units.id')
                    ->whereIn('tenancies.status', ['PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE']);
            })
            ->orderBy('id')
            ->first();

        if ($unit === null) {
            $unitId = $this->id(4);
            $unitOperationId = $this->id(5);
            $label = 'Căn kiểm thử gia hạn RNT-09';
            $unit = DB::table('units')
                ->where('property_id', $listing->property_id)
                ->where('client_operation_id', $unitOperationId)
                ->first();

            if ($unit === null) {
                $now = now();
                DB::table('units')->insert([
                    'id' => $unitId,
                    'property_id' => $listing->property_id,
                    'client_operation_id' => $unitOperationId,
                    'label' => $label,
                    'unit_kind' => 'STUDIO',
                    'description' => 'Căn mẫu dùng riêng để kiểm tra quy trình gia hạn.',
                    'floor' => '2',
                    'area_m2' => 28,
                    'bedrooms' => 1,
                    'bathrooms' => 1,
                    'bathroom_arrangement' => 'PRIVATE',
                    'amenities' => json_encode([
                        'schema_version' => 1,
                        'standard' => new \stdClass,
                        'custom' => [],
                    ], JSON_THROW_ON_ERROR),
                    'advertised_monthly_rent' => 3_800_000,
                    'deposit' => 3_800_000,
                    'minimum_rental_months' => 3,
                    'max_occupants' => 2,
                    'operational_status' => 'READY',
                    'is_marketed' => false,
                    'policy_overrides' => '{}',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $unit = DB::table('units')->where('id', $unitId)->first();
            }
        }

        if ($unit === null) {
            throw new RuntimeException('Unable to create or find the RNT-09 demo unit.');
        }

        $tenancyId = (string) Str::uuid();
        $rentalRequestId = (string) Str::uuid();
        $contractId = (string) Str::uuid();
        $renewalId = (string) Str::uuid();
        $startDate = CarbonImmutable::today()->addDays(14);
        $endDate = $startDate->addMonthsNoOverflow(6)->subDay();
        $renewalEndDate = $endDate->addMonthsNoOverflow(6);
        $now = now();

        DB::transaction(function () use (
            $owner,
            $tenant,
            $listing,
            $unit,
            $tenancyId,
            $rentalRequestId,
            $contractId,
            $renewalId,
            $startDate,
            $endDate,
            $renewalEndDate,
            $now,
        ): void {
            DB::table('rental_requests')->insert([
                'id' => $rentalRequestId,
                'listing_id' => $listing->listing_id,
                'tenant_id' => $tenant->id,
                'preferred_unit_id' => $unit->id,
                'client_operation_id' => $this->id(2),
                'desired_move_in_date' => $startDate->toDateString(),
                'desired_end_date' => $endDate->toDateString(),
                'message' => 'Yêu cầu mẫu phục vụ kiểm tra quy trình gia hạn kỳ thuê.',
                'contact_name' => $tenant->name,
                'contact_phone' => $tenant->phone,
                'status' => 'ACCEPTED',
                'availability_checked_at' => $now,
                'closed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('tenancies')->insert([
                'id' => $tenancyId,
                'unit_id' => $unit->id,
                'tenant_id' => $tenant->id,
                'owner_id' => $owner->id,
                'rental_request_id' => $rentalRequestId,
                'client_operation_id' => $this->id(1),
                'status' => 'PENDING_CONFIRMATION',
                'blocked_start_date' => $startDate->toDateString(),
                'blocked_end_date' => $endDate->toDateString(),
                'pending_contract_id' => $contractId,
                'confirmation_expires_at' => $now->copy()->addHours(48),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('tenancy_contracts')->insert([
                'id' => $contractId,
                'tenancy_id' => $tenancyId,
                'version_number' => 1,
                'type' => 'ORIGINAL',
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'monthly_rent' => $unit->advertised_monthly_rent,
                'deposit_amount' => $unit->deposit,
                'policies_snapshot' => json_encode([
                    'schema_version' => 1,
                    'pets' => 'NOT_ALLOWED',
                    'smoking' => 'NOT_ALLOWED',
                    'shared_rules' => ['Giữ yên tĩnh sau 22:00'],
                ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'document_path' => null,
                'document_sha256' => null,
                'created_by' => $owner->id,
                'owner_confirmed_at' => $now,
                'created_at' => $now,
            ]);

            DB::select(
                'SELECT set_config(?, ?, true)',
                ['rentos.actor_id', $tenant->id],
            );

            DB::table('tenancy_contracts')
                ->where('id', $contractId)
                ->update(['tenant_confirmed_at' => $now]);

            DB::table('tenancies')
                ->where('id', $tenancyId)
                ->update([
                    'status' => 'CONFIRMED',
                    'confirmed_start_date' => $startDate->toDateString(),
                    'confirmed_end_date' => $endDate->toDateString(),
                    'latest_confirmed_contract_id' => $contractId,
                    'pending_contract_id' => null,
                    'confirmation_expires_at' => null,
                    'updated_at' => $now,
                ]);

            DB::table('tenancy_renewal_requests')->insert([
                'id' => $renewalId,
                'tenancy_id' => $tenancyId,
                'client_operation_id' => $this->id(3),
                'requested_end_date' => $renewalEndDate->toDateString(),
                'proposed_monthly_rent' => $unit->advertised_monthly_rent,
                'message' => 'Tôi muốn tiếp tục thuê căn này thêm sáu tháng.',
                'status' => 'PENDING',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });

        $this->report($tenancyId, $renewalId);
    }

    private function id(int $kind): string
    {
        return sprintf('6900000%d-0000-4000-8000-000000000009', $kind);
    }

    private function report(string $tenancyId, ?string $renewalId = null): void
    {
        $renewal = DB::table('tenancy_renewal_requests')
            ->where('tenancy_id', $tenancyId)
            ->orderByDesc('created_at')
            ->first();

        $this->command?->info('RNT-09 demo tenancy: '.$tenancyId);
        $this->command?->info('RNT-09 pending renewal request: '.($renewalId ?? $renewal?->id ?? 'not found'));
        $this->command?->line('Owner login: owner1@rentos.test / password');
        $this->command?->line('Tenant login: tenant1@example.com / password');
        $this->command?->line('Fixture key: '.self::FIXTURE_KEY);
    }
}
