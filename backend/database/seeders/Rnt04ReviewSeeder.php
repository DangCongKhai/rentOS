<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use LogicException;

class Rnt04ReviewSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing']) || ! in_array(config('database.connections.pgsql.host'), ['rentos-rnt04-db', 'localhost', '127.0.0.1'], true) || ! in_array(config('database.connections.pgsql.database'), ['rentos_dev', 'rentos_test'], true)) {
            throw new LogicException('RNT-04 demo seeding requires the isolated local PostgreSQL database.');
        }

        DB::transaction(function (): void {
            $adminId = $this->id(0, 1);
            DB::table('users')->insertOrIgnore([
                'id' => $adminId, 'name' => 'Trần Minh', 'email' => 'admin.rnt04@rentos.test',
                'password' => Hash::make('password'), 'email_verified_at' => now(), 'is_admin' => true, 'account_status' => 'ACTIVE',
            ]);
            $examples = [
                ['Linh', 'Studio full nội thất gần biển Mỹ Khê', 'Studio gần biển Mỹ Khê', 5, 30],
                ['Hòa', 'Phòng trọ khép kín gần ĐH Bách khoa', 'Nhà trọ Hòa Khánh Bắc', 4, 18],
                ['Quân', 'Căn hộ 2 phòng ngủ gần biển Mỹ An', 'Căn hộ Mỹ An', 1, 13],
                ['Thảo', 'Studio yên tĩnh gần công viên 29/3', 'Nhà phố Chính Gián', 2, 3],
            ];
            foreach ($examples as $index => [$ownerName, $title, $propertyName, $unitCount, $hours]) {
                $number = $index + 1;
                $listingId = $this->id(5, $number);
                if (DB::table('listings')->where('id', $listingId)->exists()) {
                    continue;
                }
                $ownerId = $this->id(0, $number + 1);
                $propertyId = $this->id(1, $number);
                $coverId = $this->id(3, $number * 100);
                DB::table('users')->insertOrIgnore([
                    'id' => $ownerId, 'name' => $ownerName, 'email' => 'owner.rnt04.'.$number.'@rentos.test',
                    'password' => Hash::make('password'), 'email_verified_at' => now(), 'is_admin' => false, 'account_status' => 'ACTIVE',
                ]);
                DB::table('properties')->insert([
                    'id' => $propertyId, 'owner_id' => $ownerId, 'client_operation_id' => $propertyId,
                    'name' => $propertyName, 'property_type' => 'APARTMENT_BUILDING', 'rental_arrangement' => 'SEPARATE_UNITS',
                    'address_line' => ($number * 12).' Võ Nguyên Giáp', 'ward' => 'Phước Mỹ', 'city' => 'Đà Nẵng',
                    'description' => 'Nhà cho thuê dài hạn, đầy đủ nội thất cơ bản và có khu giặt chung.',
                    'shared_amenities' => json_encode(['schema_version' => 1, 'standard' => (object) [], 'custom' => ['Giặt chung', 'Bãi xe có mái che', 'Camera an ninh']], JSON_THROW_ON_ERROR),
                    'policies' => json_encode(['schema_version' => 1, 'pets' => 'NOT_ALLOWED', 'smoking' => 'NOT_ALLOWED', 'shared_rules' => ['Yên tĩnh sau 22:00']], JSON_THROW_ON_ERROR),
                ]);
                $this->media($propertyId, $coverId, $ownerId, null, 'Mặt tiền tòa nhà', 'published-property-gallery-01.png', 0);
                for ($unit = 1; $unit <= $unitCount; $unit++) {
                    $unitId = $this->id(2, $number * 100 + $unit);
                    $label = 'S20'.$unit;
                    DB::table('units')->insert([
                        'id' => $unitId, 'property_id' => $propertyId, 'client_operation_id' => $unitId,
                        'label' => $label, 'unit_kind' => 'STUDIO', 'description' => 'Căn có bếp nhỏ, điều hòa và nội thất cơ bản.',
                        'floor' => 2, 'area_m2' => 24 + $unit, 'bedrooms' => 0, 'bathrooms' => 1, 'bathroom_arrangement' => 'PRIVATE',
                        'advertised_monthly_rent' => 3600000 + $unit * 200000, 'deposit' => 3600000 + $unit * 200000,
                        'minimum_rental_months' => 3, 'max_occupants' => 2, 'operational_status' => 'READY', 'is_marketed' => true,
                    ]);
                    $this->media($propertyId, $this->id(3, $number * 100 + $unit), $ownerId, $unitId, $label, 'published-property-unit-01.png', $unit);
                }
                DB::table('listings')->insert([
                    'id' => $listingId, 'property_id' => $propertyId, 'client_operation_id' => $listingId,
                    'title' => $title, 'description' => 'Dãy studio '.$unitCount.' căn gần biển Mỹ Khê, mỗi căn đều có bếp nhỏ, điều hòa và nội thất cơ bản.',
                    'cover_media_id' => $coverId, 'moderation_status' => 'PENDING', 'publication_status' => 'DRAFT',
                    'submitted_revision' => 1, 'submitted_content_revision' => 1, 'submitted_at' => now()->subHours($hours),
                ]);
            }
        });
    }

    private function id(int $kind, int $number): string
    {
        return sprintf('6400000%d-0000-4000-8000-%012d', $kind, $number);
    }

    private function media(string $propertyId, string $id, string $ownerId, ?string $unitId, string $caption, string $file, int $sort): void
    {
        $source = database_path('seeders/fixtures/media/'.$file);
        DB::table('property_media')->insert([
            'id' => $id, 'property_id' => $propertyId, 'unit_id' => $unitId, 'uploaded_by' => $ownerId, 'client_operation_id' => $id,
            'storage_path' => 'properties/'.$propertyId.'/'.$id.'.png', 'caption' => $caption, 'sort_order' => $sort,
            'is_selected_for_listing' => true, 'mime_type' => 'image/png', 'sha256' => hash_file('sha256', $source), 'size_bytes' => filesize($source),
        ]);
    }
}
