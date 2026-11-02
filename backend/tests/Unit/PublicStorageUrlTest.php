<?php

namespace Tests\Unit;

use App\Domain\Media\PublicStorageUrl;
use Tests\TestCase;

class PublicStorageUrlTest extends TestCase
{
    public function test_it_builds_a_public_supabase_url_from_the_object_path(): void
    {
        config([
            'services.supabase.url' => 'https://example.supabase.co/',
            'services.supabase.storage.bucket' => 'property-media',
        ]);

        $url = (new PublicStorageUrl)->forPath('seed/studios/studio-01/exterior.webp');

        $this->assertSame(
            'https://example.supabase.co/storage/v1/object/public/property-media/seed/studios/studio-01/exterior.webp',
            $url,
        );
    }
}
