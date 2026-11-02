<?php

namespace Database\Seeders;

use App\Domain\Media\SharedStorageRetention;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use LogicException;
use RuntimeException;

class BaselineSeeder extends Seeder
{
    public const int MAX_PROPERTY_COUNT = 300;

    public const int USER_COUNT = 10;

    public const string ADMIN_USER_ID = '10000000-0000-4000-8000-000000000001';

    public const string OWNER_USER_ID = '10000000-0000-4000-8000-000000000002';

    public const string TENANT_USER_ID = '10000000-0000-4000-8000-000000000007';

    public const string PUBLISHED_PROPERTY_ID = '20000000-0000-4000-8000-000000000001';

    public const string DRAFT_PROPERTY_ID = '20000000-0000-4000-8000-000000000017';

    public const string PUBLISHED_UNIT_ID = '30000000-0000-4000-8000-000000000001';

    public const string DRAFT_UNIT_ID = '30000000-0000-4000-8000-000000000017';

    public const string PROPERTY_COVER_MEDIA_ID = '40000000-0000-4000-8000-000000000100';

    public const string UNIT_MEDIA_ID = '40000000-0000-4000-8000-000000000101';

    public const string PUBLISHED_LISTING_ID = '50000000-0000-4000-8000-000000000001';

    public const string DRAFT_LISTING_ID = '50000000-0000-4000-8000-000000000017';

    public const string DEVELOPMENT_PASSWORD = 'password';

    private const string FIXED_TIMESTAMP = '2026-01-01 00:00:00+00';

    /**
     * Stable demo people. Emails stay fixed so teammates can sign in with the documented accounts.
     *
     * @var array<int, array{name: string, email: string, phone: string}>
     */
    private const array PEOPLE = [
        1 => ['name' => 'Mai Anh Tran', 'email' => 'admin@rentos.test', 'phone' => '+84905111201'],
        2 => ['name' => 'Quoc Huy Le', 'email' => 'owner1@rentos.test', 'phone' => '+84913120418'],
        3 => ['name' => 'Thu Ha Nguyen', 'email' => 'owner2@rentos.test', 'phone' => '+84935670822'],
        4 => ['name' => 'Minh Khoa Pham', 'email' => 'owner3@rentos.test', 'phone' => '+84907884516'],
        5 => ['name' => 'Bao Ngoc Vo', 'email' => 'owner4@rentos.test', 'phone' => '+84983881207'],
        6 => ['name' => 'Duc Thinh Hoang', 'email' => 'owner5@rentos.test', 'phone' => '+84965440931'],
        7 => ['name' => 'Lan Chi Dang', 'email' => 'tenant1@example.com', 'phone' => '+84902337654'],
        8 => ['name' => 'Hoang Nam Bui', 'email' => 'tenant2@example.com', 'phone' => '+84914559028'],
        9 => ['name' => 'Thanh Tam Ly', 'email' => 'tenant3@example.com', 'phone' => '+84936772190'],
        10 => ['name' => 'Gia Han Truong', 'email' => 'tenant4@example.com', 'phone' => '+84981220463'],
    ];

    /** @var list<array{osmId: string, name: ?string, latitude: string, longitude: string, district: ?string, addressLine: ?string}>|null */
    private static ?array $places = null;

    public static function propertyCount(): int
    {
        return min(self::MAX_PROPERTY_COUNT, count(self::places()));
    }

    /**
     * @return array<int, string>
     */
    public static function userIds(): array
    {
        return self::ids('10000000', self::USER_COUNT);
    }

    /**
     * @return array<int, string>
     */
    public static function propertyIds(): array
    {
        return self::ids('20000000', self::propertyCount());
    }

    /**
     * @return array<int, string>
     */
    public static function unitIds(): array
    {
        return self::ids('30000000', self::propertyCount());
    }

    /**
     * @return array<int, string>
     */
    public static function listingIds(): array
    {
        return self::ids('50000000', self::propertyCount());
    }

    /**
     * @return array<int, string>
     */
    public static function mediaIds(): array
    {
        return array_column(self::mediaFixtures(), 'id');
    }

    public static function coverMediaId(int $number): string
    {
        return self::id('40000000', $number * 100);
    }

    /**
     * @return array<int, array{
     *     id: string,
     *     property_id: string,
     *     unit_id: ?string,
     *     uploaded_by: string,
     *     client_operation_id: string,
     *     source_file: string,
     *     storage_path: string,
     *     caption: string,
     *     sort_order: int
     * }>
     */
    public static function mediaFixtures(): array
    {
        $library = SeedImageLibrary::load();
        $fixtures = [];

        for ($number = 1; $number <= self::propertyCount(); $number++) {
            $place = self::place($number);
            $images = $library->imagesFor(
                $place['property_type'],
                $place['unit_kind'],
                $number,
                $place['shared_amenities']['parking']['enabled'],
                $place['shared_amenities']['laundry']['enabled'],
            );

            foreach ($images as $index => $image) {
                if ($index === 0 && $image['level'] !== 'property') {
                    throw new RuntimeException('The first library image for a property must be property-level cover media.');
                }

                $fixtures[] = [
                    'id' => self::id('40000000', $number * 100 + $index),
                    'property_id' => self::id('20000000', $number),
                    'unit_id' => $image['level'] === 'unit' ? self::id('30000000', $number) : null,
                    'uploaded_by' => self::ownerId($number),
                    'client_operation_id' => self::id('42000000', $number * 100 + $index),
                    'source_file' => $image['file'],
                    'storage_path' => $image['storage_path'],
                    'caption' => $image['caption'].' — '.$place['name'],
                    'sort_order' => $index,
                ];
            }
        }

        return $fixtures;
    }

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new LogicException('Baseline seeding is forbidden in production.');
        }

        $fixtures = self::mediaFixtures();

        DB::transaction(function () use ($fixtures): void {
            $this->seedUsers();
            $this->seedProperties();
            $this->seedUnits();
            $this->seedMedia($fixtures);
            $this->seedListings();
            $this->seedFavourites();
            $this->removeStaleBaselineMedia(array_column($fixtures, 'id'));
        });

        $this->report(count($fixtures));
    }

    private function seedUsers(): void
    {
        for ($number = 1; $number <= self::USER_COUNT; $number++) {
            $person = self::PEOPLE[$number];
            $id = self::id('10000000', $number);
            $attributes = [
                'name' => $person['name'],
                'email' => $person['email'],
                'email_verified_at' => self::FIXED_TIMESTAMP,
                'phone' => $person['phone'],
                'is_admin' => $number === 1,
                'account_status' => 'ACTIVE',
                'updated_at' => self::FIXED_TIMESTAMP,
            ];

            if (DB::table('users')->where('id', $id)->exists()) {
                DB::table('users')->where('id', $id)->update($attributes);
            } else {
                DB::table('users')->insert($attributes + [
                    'id' => $id,
                    'password' => Hash::make(self::DEVELOPMENT_PASSWORD),
                    'created_at' => self::FIXED_TIMESTAMP,
                ]);
            }
        }
    }

    private function seedProperties(): void
    {
        for ($number = 1; $number <= self::propertyCount(); $number++) {
            $place = self::place($number);

            DB::table('properties')->updateOrInsert(
                ['id' => self::id('20000000', $number)],
                [
                    'owner_id' => self::ownerId($number),
                    'client_operation_id' => self::id('21000000', $number),
                    'name' => $place['name'],
                    'property_type' => $place['property_type'],
                    'rental_arrangement' => $place['rental_arrangement'],
                    'address_line' => $place['address_line'],
                    'ward' => $place['ward'],
                    'district' => $place['district'],
                    'city' => $place['city'],
                    'description' => $place['description'],
                    'shared_amenities' => json_encode([
                        'schema_version' => 1,
                        'standard' => $place['shared_amenities'],
                        'custom' => [],
                    ], JSON_THROW_ON_ERROR),
                    'policies' => json_encode([
                        'schema_version' => 1,
                        'pets' => $place['pets'],
                        'smoking' => $place['smoking'],
                        'shared_rules' => $place['rules'],
                    ], JSON_THROW_ON_ERROR),
                    'content_revision' => 1,
                    'latitude' => $place['latitude'],
                    'longitude' => $place['longitude'],
                    'archived_at' => null,
                    'created_at' => self::FIXED_TIMESTAMP,
                    'updated_at' => self::FIXED_TIMESTAMP,
                ],
            );
        }
    }

    private function seedUnits(): void
    {
        for ($number = 1; $number <= self::propertyCount(); $number++) {
            $place = self::place($number);

            DB::table('units')->updateOrInsert(
                ['id' => self::id('30000000', $number)],
                [
                    'property_id' => self::id('20000000', $number),
                    'client_operation_id' => self::id('31000000', $number),
                    'label' => $place['unit_label'],
                    'unit_kind' => $place['unit_kind'],
                    'description' => $place['unit_description'],
                    'floor' => $place['floor'],
                    'area_m2' => $place['area_m2'],
                    'bedrooms' => $place['bedrooms'],
                    'bathrooms' => $place['bathrooms'],
                    'bathroom_arrangement' => $place['bathroom_arrangement'],
                    'amenities' => json_encode([
                        'schema_version' => 1,
                        'standard' => $place['unit_amenities'],
                        'custom' => [],
                    ], JSON_THROW_ON_ERROR),
                    'advertised_monthly_rent' => $place['rent'],
                    'deposit' => $place['deposit'],
                    'minimum_rental_months' => $place['minimum_rental_months'],
                    'max_occupants' => $place['max_occupants'],
                    'operational_status' => 'READY',
                    'is_marketed' => true,
                    'policy_overrides' => '{}',
                    'archived_at' => null,
                    'created_at' => self::FIXED_TIMESTAMP,
                    'updated_at' => self::FIXED_TIMESTAMP,
                ],
            );
        }
    }

    /**
     * @param  array<int, array{id: string, property_id: string, unit_id: ?string, uploaded_by: string, client_operation_id: string, source_file: string, storage_path: string, caption: string, sort_order: int}>  $fixtures
     */
    private function seedMedia(array $fixtures): void
    {
        $library = SeedImageLibrary::load();

        foreach ($fixtures as $fixture) {
            $metadata = $library->metadata($fixture['source_file']);

            DB::table('property_media')->updateOrInsert(
                ['id' => $fixture['id']],
                [
                    'property_id' => $fixture['property_id'],
                    'unit_id' => $fixture['unit_id'],
                    'uploaded_by' => $fixture['uploaded_by'],
                    'client_operation_id' => $fixture['client_operation_id'],
                    'storage_path' => $fixture['storage_path'],
                    'caption' => $fixture['caption'],
                    'sort_order' => $fixture['sort_order'],
                    'is_selected_for_listing' => true,
                    'purged_at' => null,
                    'created_at' => self::FIXED_TIMESTAMP,
                    'updated_at' => self::FIXED_TIMESTAMP,
                    'deleted_at' => null,
                    'sha256' => $metadata['sha256'],
                    'mime_type' => $metadata['mime_type'],
                    'size_bytes' => $metadata['size_bytes'],
                ],
            );
        }
    }

    private function seedListings(): void
    {
        for ($number = 1; $number <= self::propertyCount(); $number++) {
            $place = self::place($number);
            $id = self::id('50000000', $number);
            $base = [
                'property_id' => self::id('20000000', $number),
                'client_operation_id' => self::id('51000000', $number),
                'title' => $place['listing_title'],
                'description' => $place['listing_description'],
                'cover_media_id' => self::coverMediaId($number),
                'review_reason' => null,
                'archived_at' => null,
                'admin_suspended_at' => null,
                'admin_suspended_by' => null,
                'suspension_reason' => null,
                'updated_at' => self::FIXED_TIMESTAMP,
            ];

            if (! DB::table('listings')->where('id', $id)->exists()) {
                DB::table('listings')->insert([
                    'id' => $id,
                    'property_id' => $base['property_id'],
                    'client_operation_id' => $base['client_operation_id'],
                    'title' => $base['title'],
                    'description' => $base['description'],
                    'cover_media_id' => null,
                    'moderation_status' => 'DRAFT',
                    'publication_status' => 'DRAFT',
                    'created_at' => self::FIXED_TIMESTAMP,
                    'updated_at' => self::FIXED_TIMESTAMP,
                ]);
                DB::table('listings')->where('id', $id)->update([
                    'cover_media_id' => self::coverMediaId($number),
                    'moderation_status' => 'PENDING',
                    'submitted_revision' => 1,
                    'submitted_at' => self::FIXED_TIMESTAMP,
                    'submitted_content_revision' => 1,
                ]);
                DB::table('listings')->where('id', $id)->update([
                    'moderation_status' => 'APPROVED',
                    'reviewed_by' => self::ADMIN_USER_ID,
                    'reviewed_at' => self::FIXED_TIMESTAMP,
                    'approved_content_revision' => 1,
                ]);
                DB::table('listings')->where('id', $id)->update([
                    'publication_status' => 'PUBLISHED',
                ]);
            } else {
                DB::table('listings')->where('id', $id)->update($base + [
                    'moderation_status' => 'APPROVED',
                    'publication_status' => 'PUBLISHED',
                    'submitted_revision' => 1,
                    'submitted_at' => self::FIXED_TIMESTAMP,
                    'reviewed_by' => self::ADMIN_USER_ID,
                    'reviewed_at' => self::FIXED_TIMESTAMP,
                    'submitted_content_revision' => 1,
                    'approved_content_revision' => 1,
                ]);
            }
        }
    }

    private function seedFavourites(): void
    {
        foreach (range(7, 10) as $userNumber) {
            DB::table('favourite_properties')->updateOrInsert(
                [
                    'user_id' => self::id('10000000', $userNumber),
                    'property_id' => self::id('20000000', $userNumber - 6),
                ],
                ['created_at' => self::FIXED_TIMESTAMP],
            );
        }
    }

    /**
     * @param  list<string>  $keepIds
     */
    private function removeStaleBaselineMedia(array $keepIds): void
    {
        DB::table('property_media')
            ->whereIn('property_id', self::propertyIds())
            ->whereNotIn('id', $keepIds)
            ->where(function (Builder $query): void {
                $query->whereRaw("id::text like '40000000-0000-4000-8000-%'")
                    ->orWhereRaw("id::text like '41000000-0000-4000-8000-%'");
            })
            ->delete();
    }

    private function report(int $mediaRows): void
    {
        $propertyIds = self::propertyIds();
        $uniquePaths = (int) DB::table('property_media')
            ->whereIn('property_id', $propertyIds)
            ->selectRaw('count(distinct storage_path) as aggregate')
            ->value('aggregate');

        $this->command?->info(sprintf(
            'Seeded %d Da Nang properties, %d units, %d published listings, %d media rows, and %d unique storage paths under %s.',
            count($propertyIds),
            count(self::unitIds()),
            count(self::listingIds()),
            $mediaRows,
            $uniquePaths,
            SharedStorageRetention::SEED_PREFIX,
        ));
    }

    /**
     * @return list<array{osmId: string, name: ?string, latitude: string, longitude: string, district: ?string, addressLine: ?string}>
     */
    private static function places(): array
    {
        if (self::$places !== null) {
            return self::$places;
        }

        $path = database_path('seeders/da-nang-places.json');
        $source = is_file($path) ? file_get_contents($path) : false;
        $decoded = is_string($source) ? json_decode($source, true) : null;

        if (! is_array($decoded) || $decoded === []) {
            throw new RuntimeException('da-nang-places.json is missing or does not contain a place array.');
        }

        self::$places = array_values($decoded);

        return self::$places;
    }

    /**
     * @return array{
     *     name: string,
     *     listing_title: string,
     *     listing_description: string,
     *     property_type: string,
     *     rental_arrangement: string,
     *     address_line: string,
     *     ward: ?string,
     *     district: string,
     *     city: string,
     *     description: string,
     *     latitude: string,
     *     longitude: string,
     *     pets: string,
     *     smoking: string,
     *     rules: array<int, string>,
     *     shared_amenities: array<string, array{enabled: bool}>,
     *     unit_label: string,
     *     unit_kind: string,
     *     unit_description: string,
     *     floor: string,
     *     area_m2: int,
     *     bedrooms: int,
     *     bathrooms: int,
     *     bathroom_arrangement: string,
     *     unit_amenities: array<string, array{enabled: bool}>,
     *     rent: int,
     *     deposit: int,
     *     minimum_rental_months: int,
     *     max_occupants: int
     * }
     */
    private static function place(int $number): array
    {
        $places = self::places();
        $raw = $places[$number - 1] ?? null;

        if (! is_array($raw)) {
            throw new RuntimeException("Da Nang place {$number} is not available.");
        }

        $latitude = (string) $raw['latitude'];
        $longitude = (string) $raw['longitude'];
        $district = self::districtFor((float) $latitude, (float) $longitude, $raw['district'] ?? null);
        $address = trim((string) ($raw['addressLine'] ?? ''));
        $recordedName = trim((string) ($raw['name'] ?? ''));

        if ($address === '') {
            $address = $latitude.', '.$longitude;
        }

        $name = $recordedName !== '' ? $recordedName : $address;
        $propertyType = ['HOUSE', 'APARTMENT', 'APARTMENT_BUILDING'][$number % 3];
        $whole = $number % 2 === 0;
        $unitKind = match ($propertyType) {
            'HOUSE' => $whole ? 'HOUSE' : 'ROOM',
            'APARTMENT_BUILDING' => $number % 4 === 0 ? 'APARTMENT' : 'STUDIO',
            default => $whole ? 'APARTMENT' : 'STUDIO',
        };
        $bedrooms = match ($unitKind) {
            'STUDIO' => 0,
            'ROOM' => 1,
            'APARTMENT' => 1 + ($number % 2),
            default => 2 + ($number % 2),
        };
        $areaM2 = match ($unitKind) {
            'ROOM' => 16 + ($number % 8),
            'STUDIO' => 24 + ($number % 12),
            'APARTMENT' => 48 + ($number % 25),
            default => 80 + ($number % 40),
        };
        $rentBase = match ($district) {
            'Sơn Trà', 'Hải Châu' => 8000000,
            'Thanh Khê' => 6500000,
            'Ngũ Hành Sơn' => 9000000,
            default => 5000000,
        };
        $rent = $rentBase + (($number % 5) * 250000);
        $label = match ($unitKind) {
            'HOUSE' => 'Nguyên căn',
            'ROOM' => 'Phòng '.chr(65 + ($number % 4)),
            'STUDIO' => 'Studio '.(($number % 12) + 1),
            default => 'Căn '.(($number % 20) + 101),
        };

        return [
            'name' => $name,
            'listing_title' => "{$label} tại {$name}",
            'listing_description' => "Cho thuê {$label} tại {$address}, {$district}, Đà Nẵng. Dữ liệu demo, không phải nhà đang rao thật.",
            'property_type' => $propertyType,
            'rental_arrangement' => $whole ? 'WHOLE_SPACE' : 'SEPARATE_UNITS',
            'address_line' => $address,
            'ward' => null,
            'district' => $district,
            'city' => 'Đà Nẵng',
            'description' => "Nhà cho thuê demo tại {$district}, Đà Nẵng. Tọa độ lấy từ dữ liệu mở, không đại diện cho một tin đăng thật.",
            'latitude' => $latitude,
            'longitude' => $longitude,
            'pets' => ['NOT_ALLOWED', 'ASK_OWNER', 'ALLOWED'][$number % 3],
            'smoking' => $number % 4 === 0 ? 'OUTDOOR_ONLY' : 'NOT_ALLOWED',
            'rules' => ['Giữ yên tĩnh sau 22:00'],
            'shared_amenities' => [
                'wifi' => ['enabled' => true],
                'parking' => ['enabled' => $number % 2 === 0],
                'elevator' => ['enabled' => $propertyType === 'APARTMENT_BUILDING'],
                'laundry' => ['enabled' => $number % 3 === 0],
            ],
            'unit_label' => $label,
            'unit_kind' => $unitKind,
            'unit_description' => "{$label} tại {$name}, {$district}.",
            'floor' => (string) (1 + ($number % 15)),
            'area_m2' => $areaM2,
            'bedrooms' => $bedrooms,
            'bathrooms' => $bedrooms === 0 ? 1 : min($bedrooms, 2),
            'bathroom_arrangement' => $unitKind === 'ROOM' ? 'SHARED' : 'PRIVATE',
            'unit_amenities' => [
                'air_conditioning' => ['enabled' => true],
                'washing_machine' => ['enabled' => $areaM2 >= 40],
                'kitchen' => ['enabled' => $unitKind !== 'ROOM'],
            ],
            'rent' => $rent,
            'deposit' => $rent * ($number % 2 === 0 ? 2 : 1),
            'minimum_rental_months' => [3, 6, 12][$number % 3],
            'max_occupants' => max(1, $bedrooms === 0 ? 2 : $bedrooms + 1),
        ];
    }

    /**
     * OpenStreetMap often omits the district. The fallback only covers this Da Nang extract.
     */
    private static function districtFor(float $latitude, float $longitude, mixed $recorded): string
    {
        if (is_string($recorded) && trim($recorded) !== '') {
            return trim($recorded);
        }

        if ($longitude >= 108.230 || ($latitude >= 16.075 && $longitude >= 108.210)) {
            return 'Sơn Trà';
        }

        if ($longitude < 108.175) {
            return 'Liên Chiểu';
        }

        if ($latitude < 16.040 && $longitude < 108.205) {
            return 'Cẩm Lệ';
        }

        if ($latitude < 16.030) {
            return 'Ngũ Hành Sơn';
        }

        if ($longitude < 108.200) {
            return 'Thanh Khê';
        }

        return 'Hải Châu';
    }

    private static function ownerId(int $number): string
    {
        $ownerNumbers = [2, 3, 4, 5, 6];

        return self::id('10000000', $ownerNumbers[($number - 1) % count($ownerNumbers)]);
    }

    private static function id(string $prefix, int $number): string
    {
        return sprintf('%s-0000-4000-8000-%012d', $prefix, $number);
    }

    /**
     * @return array<int, string>
     */
    private static function ids(string $prefix, int $count): array
    {
        return array_map(
            fn (int $number): string => self::id($prefix, $number),
            range(1, $count),
        );
    }
}
