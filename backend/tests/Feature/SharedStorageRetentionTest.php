<?php

namespace Tests\Feature;

use App\Domain\Media\SharedStorageRetention;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class SharedStorageRetentionTest extends TestCase
{
    use RefreshDatabase;

    public function test_seed_library_objects_are_never_eligible_for_physical_delete(): void
    {
        $retention = new SharedStorageRetention;

        $this->assertFalse($retention->allowsPhysicalDelete('seed/studios/studio-01/exterior.png'));
        $this->assertFalse($retention->allowsPhysicalDelete('seed/../owners/private.png'));
    }

    public function test_a_shared_file_stays_until_every_live_reference_is_gone(): void
    {
        $first = PublicListingFixture::published();
        $second = PublicListingFixture::published();
        $path = 'owners/shared-room.png';
        $retention = new SharedStorageRetention;
        $now = now();
        $firstMediaId = (string) Str::uuid();
        $secondMediaId = (string) Str::uuid();

        DB::table('property_media')->insert([
            $this->association($firstMediaId, $first->propertyId, $first->owner->id, $path, $now),
            $this->association($secondMediaId, $second->propertyId, $second->owner->id, $path, $now),
        ]);

        $this->assertFalse($retention->allowsPhysicalDelete($path));

        DB::table('property_media')->where('id', $firstMediaId)->delete();

        $this->assertFalse($retention->allowsPhysicalDelete($path));

        DB::table('property_media')->where('id', $secondMediaId)->update([
            'deleted_at' => $now,
            'purged_at' => $now,
        ]);

        $this->assertTrue($retention->allowsPhysicalDelete($path));
        $this->assertFalse($retention->allowsPhysicalDelete('seed/shared/parking-01.png'));
    }

    /**
     * @return array<string, mixed>
     */
    private function association(string $id, string $propertyId, string $ownerId, string $path, mixed $now): array
    {
        return [
            'id' => $id,
            'property_id' => $propertyId,
            'unit_id' => null,
            'uploaded_by' => $ownerId,
            'client_operation_id' => (string) Str::uuid(),
            'storage_path' => $path,
            'caption' => 'Ảnh dùng chung',
            'sort_order' => 4,
            'is_selected_for_listing' => false,
            'sha256' => hash('sha256', $id),
            'mime_type' => 'image/png',
            'size_bytes' => 128,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
}
