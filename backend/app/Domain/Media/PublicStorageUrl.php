<?php

namespace App\Domain\Media;

use RuntimeException;

/**
 * Listing photos are read by guests, so the browser loads a public Storage URL.
 * The database keeps the object path. This class only adds the Supabase public prefix.
 */
final class PublicStorageUrl
{
    public function forPath(string $storagePath): string
    {
        $base = rtrim((string) config('services.supabase.url'), '/');
        $bucket = trim((string) config('services.supabase.storage.bucket'));

        if ($base === '' || $bucket === '') {
            throw new RuntimeException('Supabase public storage is not configured.');
        }

        $path = ltrim(str_replace('\\', '/', $storagePath), '/');
        $encodedPath = implode('/', array_map(rawurlencode(...), explode('/', $path)));

        return $base.'/storage/v1/object/public/'.rawurlencode($bucket).'/'.$encodedPath;
    }
}
