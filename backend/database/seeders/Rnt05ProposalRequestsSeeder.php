<?php

namespace Database\Seeders;

use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use LogicException;
use RuntimeException;

class Rnt05ProposalRequestsSeeder extends Seeder
{
    /** @var list<array{name: string, phone: string, message: string}> */
    private const array TENANTS = [
        ['name' => 'Nguyễn Minh Anh', 'phone' => '0905001001', 'message' => 'Tôi muốn thuê căn này trong thời gian dài.'],
        ['name' => 'Trần Quốc Bảo', 'phone' => '0905001002', 'message' => 'Tôi quan tâm đến căn hộ và muốn trao đổi thêm về ngày nhận nhà.'],
        ['name' => 'Lê Thu Hà', 'phone' => '0905001003', 'message' => 'Căn hộ phù hợp với nhu cầu của tôi. Mong chủ nhà phản hồi.'],
        ['name' => 'Phạm Gia Huy', 'phone' => '0905001004', 'message' => 'Tôi muốn gửi yêu cầu thuê căn này, cảm ơn chủ nhà.'],
        ['name' => 'Võ Ngọc Linh', 'phone' => '0905001005', 'message' => 'Tôi sẵn sàng trao đổi và xác nhận các điều khoản thuê.'],
    ];

    public function run(): void
    {
        $host = config('database.connections.pgsql.host');
        $database = config('database.connections.pgsql.database');

        if (
            ! app()->environment(['local', 'testing'])
            || ! in_array($host, ['rentos-rnt05-db', 'localhost', '127.0.0.1', 'db'], true)
            || ! in_array($database, ['postgres', 'rentos_dev', 'rentos_test'], true)
        ) {
            throw new LogicException('RNT-05 demo requests can only be seeded into the isolated local PostgreSQL database.');
        }

        $owner = DB::table('users')->where('email', 'owner1@rentos.test')->first();

        if ($owner === null) {
            throw new RuntimeException(
                'The demo owner was not found. Run BaselineSeeder first: php artisan db:seed --class="Database\\Seeders\\BaselineSeeder".',
            );
        }

        $listings = DB::table('listings')
            ->join('properties', 'properties.id', '=', 'listings.property_id')
            ->join('units', 'units.property_id', '=', 'properties.id')
            ->where('properties.owner_id', $owner->id)
            ->where('listings.moderation_status', 'APPROVED')
            ->where('listings.publication_status', 'PUBLISHED')
            ->whereNull('listings.archived_at')
            ->whereNull('properties.archived_at')
            ->whereNull('units.archived_at')
            ->where('units.operational_status', 'READY')
            ->where('units.is_marketed', true)
            ->orderBy('listings.id')
            ->get([
                'listings.id as listing_id',
                'listings.title as listing_title',
                'properties.name as property_name',
                'units.id as unit_id',
            ])
            ->unique('listing_id')
            ->values();

        if ($listings->isEmpty()) {
            throw new RuntimeException(
                'No published, approved listing with a ready unit was found for owner1@rentos.test. Run BaselineSeeder first.',
            );
        }

        $created = 0;
        $skipped = 0;

        DB::transaction(function () use ($listings, &$created, &$skipped): void {
            foreach (self::TENANTS as $index => $tenantData) {
                $number = $index + 1;
                $tenantId = $this->id(0, $number);
                $tenantEmail = "tenant.rnt05.{$number}@rentos.test";

                DB::table('users')->insertOrIgnore([
                    'id' => $tenantId,
                    'name' => $tenantData['name'],
                    'email' => $tenantEmail,
                    'email_verified_at' => now(),
                    'password' => Hash::make('password'),
                    'phone' => $tenantData['phone'],
                    'is_admin' => false,
                    'account_status' => 'ACTIVE',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $tenantId = (string) DB::table('users')
                    ->where('email', $tenantEmail)
                    ->value('id');

                if (DB::table('rental_requests')->where('id', $this->id(1, $number))->exists()) {
                    $skipped++;

                    continue;
                }

                $listing = $listings[$index % $listings->count()];
                $startDate = CarbonImmutable::now()->addDays(30 + ($index * 120));
                $endDate = $startDate->addMonthsNoOverflow(3)->subDay();
                $requestId = $this->id(1, $number);
                $now = now();

                DB::table('rental_requests')->insert([
                    'id' => $requestId,
                    'listing_id' => $listing->listing_id,
                    'tenant_id' => $tenantId,
                    'preferred_unit_id' => $listing->unit_id,
                    'client_operation_id' => $this->id(2, $number),
                    'desired_move_in_date' => $startDate->toDateString(),
                    'desired_end_date' => $endDate->toDateString(),
                    'message' => $tenantData['message'],
                    'status' => 'PENDING',
                    'outcome_reason' => null,
                    'created_at' => $now->copy()->subMinutes(5 - $index),
                    'updated_at' => $now,
                    'contact_name' => $tenantData['name'],
                    'contact_phone' => $tenantData['phone'],
                    'availability_checked_at' => $now,
                    'closed_at' => null,
                ]);

                $created++;
            }
        });

        $this->command?->info("Created {$created} RNT-05 rental requests and skipped {$skipped} existing requests.");
        $this->command?->line('Owner login: owner1@rentos.test / password');
        $this->command?->line('Tenant logins: tenant.rnt05.1@rentos.test through tenant.rnt05.5@rentos.test / password');
    }

    private function id(int $kind, int $number): string
    {
        return sprintf('6500000%d-0000-4000-8000-%012d', $kind, $number);
    }
}
