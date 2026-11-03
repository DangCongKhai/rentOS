<?php

namespace Tests\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

trait CreatesListingReviewPackages
{
    protected function assertReviewDatabaseIsIsolated(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    /**
     * @param  array<string, mixed>  $listingAttributes
     * @return array{listing_id: string, property_id: string, unit_id: string, shared_media_id: string, unit_media_id: string, owner: User}
     */
    protected function createReviewPackage(array $listingAttributes = [], ?User $owner = null): array
    {
        $owner ??= User::factory()->create(['name' => 'Chủ nhà Hòa']);
        $propertyId = (string) Str::uuid();
        $unitId = (string) Str::uuid();
        $sharedMediaId = (string) Str::uuid();
        $unitMediaId = (string) Str::uuid();
        $listingId = (string) Str::uuid();

        DB::table('properties')->insert([
            'id' => $propertyId, 'owner_id' => $owner->id, 'client_operation_id' => (string) Str::uuid(),
            'name' => 'Studio gần biển Mỹ Khê', 'property_type' => 'APARTMENT_BUILDING', 'rental_arrangement' => 'SEPARATE_UNITS',
            'address_line' => '12 Võ Nguyên Giáp', 'ward' => 'Phước Mỹ', 'city' => 'Đà Nẵng',
            'description' => 'Nhà cho thuê dài hạn gần biển.',
            'policies' => $this->reviewJson(['schema_version' => 1, 'pets' => 'NOT_ALLOWED', 'smoking' => 'NOT_ALLOWED', 'shared_rules' => ['Yên tĩnh sau 22:00']]),
        ]);
        $this->insertReviewUnit($propertyId, $unitId, 'S201');
        $this->insertReviewMedia($propertyId, $sharedMediaId, $owner->id);
        $this->insertReviewMedia($propertyId, $unitMediaId, $owner->id, $unitId);
        DB::table('listings')->insert(array_merge([
            'id' => $listingId, 'property_id' => $propertyId, 'client_operation_id' => (string) Str::uuid(),
            'title' => 'Studio full nội thất gần biển Mỹ Khê', 'description' => 'Studio có nội thất và phòng tắm riêng.',
            'cover_media_id' => $sharedMediaId, 'moderation_status' => 'PENDING', 'publication_status' => 'DRAFT',
            'submitted_revision' => 1, 'submitted_content_revision' => 1, 'submitted_at' => '2026-10-28 09:00:00+00',
        ], $listingAttributes));

        return ['listing_id' => $listingId, 'property_id' => $propertyId, 'unit_id' => $unitId, 'shared_media_id' => $sharedMediaId, 'unit_media_id' => $unitMediaId, 'owner' => $owner];
    }

    protected function insertReviewUnit(string $propertyId, string $unitId, string $label, bool $marketed = true): void
    {
        DB::table('units')->insert([
            'id' => $unitId, 'property_id' => $propertyId, 'client_operation_id' => (string) Str::uuid(),
            'label' => $label, 'unit_kind' => 'STUDIO', 'description' => 'Căn đầy đủ nội thất.',
            'area_m2' => 24, 'bedrooms' => 0, 'bathrooms' => 1, 'bathroom_arrangement' => 'PRIVATE',
            'advertised_monthly_rent' => 3800000, 'deposit' => 3800000, 'minimum_rental_months' => 3,
            'max_occupants' => 2, 'operational_status' => 'READY', 'is_marketed' => $marketed,
        ]);
    }

    protected function insertReviewMedia(string $propertyId, string $mediaId, string $ownerId, ?string $unitId = null, bool $selected = true): void
    {
        DB::table('property_media')->insert([
            'id' => $mediaId, 'property_id' => $propertyId, 'unit_id' => $unitId, 'uploaded_by' => $ownerId,
            'client_operation_id' => (string) Str::uuid(), 'storage_path' => "properties/{$propertyId}/{$mediaId}.png",
            'caption' => $unitId ? 'Nội thất căn S201' : 'Mặt tiền tòa nhà', 'sort_order' => 0,
            'is_selected_for_listing' => $selected, 'sha256' => str_repeat('a', 64), 'mime_type' => 'image/png', 'size_bytes' => 1024,
        ]);
    }

    protected function reviewJson(array $data): string
    {
        return json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }
}
