<?php

namespace App\Domain\Media;

use Illuminate\Support\Facades\DB;

/**
 * storage_path identifies a file, not an owner.
 * A physical delete is allowed only when no live row still points at that object,
 * and never for the shared seed library.
 */
final class SharedStorageRetention
{
    public const string SEED_PREFIX = 'seed/';

    public function allowsPhysicalDelete(string $storagePath): bool
    {
        if ($this->isReservedSeedObject($storagePath)) {
            return false;
        }

        return ! DB::table('property_media')
            ->where('storage_path', $storagePath)
            ->whereNull('purged_at')
            ->exists();
    }

    public function isReservedSeedObject(string $storagePath): bool
    {
        $path = ltrim(str_replace('\\', '/', $storagePath), '/');

        if (str_contains($path, '..')) {
            return true;
        }

        return str_starts_with($path, self::SEED_PREFIX);
    }
}
