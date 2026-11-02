<?php

namespace Tests\Feature;

use Database\Seeders\SeedImageLibrary;
use Tests\TestCase;

class SeedImageLibraryTest extends TestCase
{
    public function test_manifest_lists_a_shared_library_of_local_pngs(): void
    {
        $library = SeedImageLibrary::load();
        $images = $library->images();
        $paths = array_column($images, 'storage_path');

        $this->assertGreaterThanOrEqual(100, count($images));
        $this->assertLessThanOrEqual(150, count($images));
        $this->assertSame($paths, array_values(array_unique($paths)));

        foreach ($images as $image) {
            $this->assertStringStartsWith('seed/', $image['storage_path']);
            $this->assertFileExists($library->absolutePath($image['file']));
            $metadata = $library->metadata($image['file']);
            $this->assertSame('image/webp', $metadata['mime_type']);
            $this->assertSame(64, strlen($metadata['sha256']));
        }
    }

    public function test_every_seeded_property_shape_has_a_coherent_image_set(): void
    {
        $library = SeedImageLibrary::load();
        $shapes = [
            ['HOUSE', 'HOUSE'],
            ['HOUSE', 'ROOM'],
            ['APARTMENT', 'APARTMENT'],
            ['APARTMENT', 'STUDIO'],
            ['APARTMENT_BUILDING', 'APARTMENT'],
            ['APARTMENT_BUILDING', 'STUDIO'],
        ];

        foreach ($shapes as [$propertyType, $unitKind]) {
            $images = $library->imagesFor($propertyType, $unitKind, 1, true, true);

            $this->assertSame('property', $images[0]['level']);
            $this->assertContains('unit', array_column($images, 'level'));
            $this->assertNotEmpty(array_filter(
                $images,
                fn (array $image): bool => str_contains($image['storage_path'], '/shared/'),
            ));
        }
    }
}
