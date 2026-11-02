<?php

namespace Tests\Feature;

use Database\Seeders\BaselineSeeder;
use Database\Seeders\SeedImageLibrary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class BaselineSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_baseline_uses_da_nang_places_and_shared_library_images(): void
    {
        $this->assertSame(200, BaselineSeeder::propertyCount());

        $this->seed(BaselineSeeder::class);

        $this->assertDatabaseCount('properties', 200);
        $this->assertDatabaseCount('units', 200);
        $this->assertDatabaseCount('listings', 200);
        $this->assertSame(200, DB::table('listings')->where('publication_status', 'PUBLISHED')->count());
        $this->assertSame(0, DB::table('properties')->where('city', '!=', 'Đà Nẵng')->count());
        $this->assertSame(0, DB::table('property_media')->where('storage_path', 'not like', 'seed/%')->count());
        $this->assertSame(0, DB::table('property_media as media')
            ->join('units', 'units.id', '=', 'media.unit_id')
            ->whereColumn('units.property_id', '!=', 'media.property_id')
            ->count());

        $property = DB::table('properties')->where('id', BaselineSeeder::PUBLISHED_PROPERTY_ID)->first();
        $this->assertNotNull($property);
        $this->assertSame('Chung cư Hoàng Anh Gia Lai', $property->name);
        $this->assertSame('Hàm Nghi', $property->address_line);
        $this->assertSame('Hải Châu', $property->district);
        $this->assertEqualsWithDelta(16.062588, (float) $property->latitude, 0.0000001);
        $this->assertEqualsWithDelta(108.210201, (float) $property->longitude, 0.0000001);
        $amenities = json_decode((string) $property->shared_amenities, true);
        $this->assertTrue($amenities['standard']['wifi']['enabled']);

        $cover = DB::table('property_media')->where('id', BaselineSeeder::PROPERTY_COVER_MEDIA_ID)->first();
        $this->assertNotNull($cover);
        $this->assertNull($cover->unit_id);
        $this->assertSame(BaselineSeeder::PUBLISHED_PROPERTY_ID, $cover->property_id);
        $this->assertStringStartsWith('seed/', $cover->storage_path);

        $sharedPath = DB::table('property_media')
            ->select('storage_path')
            ->groupBy('storage_path')
            ->havingRaw('count(distinct property_id) > 1')
            ->value('storage_path');
        $this->assertIsString($sharedPath);

        $library = SeedImageLibrary::load();
        $source = collect($library->images())->firstWhere('storage_path', $sharedPath);
        $this->assertIsArray($source);
        $metadata = $library->metadata($source['file']);
        $row = DB::table('property_media')->where('storage_path', $sharedPath)->first();
        $this->assertNotNull($row);
        $this->assertSame($metadata['sha256'], $row->sha256);
        $this->assertSame($metadata['mime_type'], $row->mime_type);
        $this->assertSame($metadata['size_bytes'], (int) $row->size_bytes);

        $mediaCount = DB::table('property_media')->count();
        $propertyId = BaselineSeeder::PUBLISHED_PROPERTY_ID;
        $staleId = '41000000-0000-4000-8000-000000000099';
        $customId = (string) Str::uuid();
        $now = now();
        DB::table('property_media')->insert([
            [
                'id' => $staleId,
                'property_id' => $propertyId,
                'unit_id' => null,
                'uploaded_by' => BaselineSeeder::OWNER_USER_ID,
                'client_operation_id' => '43000000-0000-4000-8000-000000000099',
                'storage_path' => 'properties/old/unit-01.png',
                'caption' => 'Ảnh cũ',
                'sort_order' => 8,
                'is_selected_for_listing' => false,
                'sha256' => hash('sha256', 'stale'),
                'mime_type' => 'image/png',
                'size_bytes' => 64,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => $customId,
                'property_id' => $propertyId,
                'unit_id' => null,
                'uploaded_by' => BaselineSeeder::OWNER_USER_ID,
                'client_operation_id' => (string) Str::uuid(),
                'storage_path' => 'owners/custom-photo.png',
                'caption' => 'Ảnh chủ nhà',
                'sort_order' => 9,
                'is_selected_for_listing' => false,
                'sha256' => hash('sha256', 'custom'),
                'mime_type' => 'image/png',
                'size_bytes' => 64,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $this->seed(BaselineSeeder::class);

        $this->assertDatabaseCount('properties', 200);
        $this->assertDatabaseMissing('property_media', ['id' => $staleId]);
        $this->assertDatabaseHas('property_media', ['id' => $customId, 'storage_path' => 'owners/custom-photo.png']);
        $this->assertSame($mediaCount + 1, DB::table('property_media')->count());
    }
}
