<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class PropertyMediaSharedPathTest extends TestCase
{
    use RefreshDatabase;

    public function test_two_media_rows_can_reference_one_storage_path(): void
    {
        $first = PublicListingFixture::published();
        $second = PublicListingFixture::published();
        $sharedPath = (string) DB::table('property_media')->where('id', $first->coverMediaId)->value('storage_path');

        DB::table('property_media')->insert($this->mediaRow($second->propertyId, $second->owner->id, [
            'storage_path' => $sharedPath,
        ]));

        $this->assertSame(2, DB::table('property_media')->where('storage_path', $sharedPath)->count());
    }

    public function test_duplicate_client_operation_for_one_uploader_is_rejected(): void
    {
        $published = PublicListingFixture::published();
        $existing = DB::table('property_media')->where('id', $published->coverMediaId)->first();
        $this->assertNotNull($existing);

        $this->expectException(QueryException::class);

        DB::table('property_media')->insert($this->mediaRow($published->propertyId, $published->owner->id, [
            'client_operation_id' => $existing->client_operation_id,
            'storage_path' => 'owners/'.Str::uuid().'.png',
        ]));
    }

    public function test_media_rejects_a_unit_from_another_property(): void
    {
        $first = PublicListingFixture::published();
        $second = PublicListingFixture::published();

        $this->expectException(QueryException::class);

        DB::table('property_media')->insert($this->mediaRow($first->propertyId, $first->owner->id, [
            'unit_id' => $second->unitIds[0],
            'storage_path' => 'owners/'.Str::uuid().'.png',
        ]));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function mediaRow(string $propertyId, string $ownerId, array $overrides): array
    {
        $now = now();

        return array_merge([
            'id' => (string) Str::uuid(),
            'property_id' => $propertyId,
            'unit_id' => null,
            'uploaded_by' => $ownerId,
            'client_operation_id' => (string) Str::uuid(),
            'storage_path' => 'owners/'.Str::uuid().'.png',
            'caption' => 'Ảnh dùng chung',
            'sort_order' => 4,
            'is_selected_for_listing' => true,
            'sha256' => hash('sha256', 'shared-path'),
            'mime_type' => 'image/png',
            'size_bytes' => 128,
            'created_at' => $now,
            'updated_at' => $now,
        ], $overrides);
    }
}
