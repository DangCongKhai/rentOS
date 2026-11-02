<?php

namespace Database\Seeders;

use App\Domain\Media\SharedStorageRetention;
use RuntimeException;

final class SeedImageLibrary
{
    /**
     * @param  list<array{
     *     id: string,
     *     property_types: list<string>,
     *     unit_kinds: list<string>,
     *     images: list<array{file: string, storage_path: string, level: string, caption: string}>
     * }>  $sets
     * @param  list<array{amenity: string, file: string, storage_path: string, level: string, caption: string}>  $shared
     */
    private function __construct(
        private array $sets,
        private array $shared,
        private string $directory,
    ) {}

    public static function load(): self
    {
        $directory = config('services.supabase.storage.fixture_directory');

        if (! is_string($directory) || trim($directory) === '') {
            throw new RuntimeException('The media fixture directory is not configured.');
        }

        $manifestPath = rtrim($directory, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'manifest.json';
        $contents = is_file($manifestPath) ? file_get_contents($manifestPath) : false;
        $decoded = is_string($contents) ? json_decode($contents, true) : null;

        if (! is_array($decoded) || ! is_array($decoded['sets'] ?? null) || ! is_array($decoded['shared'] ?? null)) {
            throw new RuntimeException('The media library manifest is missing or invalid.');
        }

        /** @var list<array{id: string, property_types: list<string>, unit_kinds: list<string>, images: list<array{file: string, storage_path: string, level: string, caption: string}>}> $sets */
        $sets = $decoded['sets'];
        /** @var list<array{amenity: string, file: string, storage_path: string, level: string, caption: string}> $shared */
        $shared = $decoded['shared'];

        $library = new self($sets, $shared, rtrim($directory, DIRECTORY_SEPARATOR));
        $library->assertValid();

        return $library;
    }

    /**
     * @return list<array{file: string, storage_path: string, level: string, caption: string}>
     */
    public function images(): array
    {
        $images = [];

        foreach ($this->sets as $set) {
            foreach ($set['images'] as $image) {
                $images[] = $image;
            }
        }

        foreach ($this->shared as $image) {
            $images[] = $image;
        }

        return $images;
    }

    /**
     * @return list<array{file: string, storage_path: string, level: string, caption: string}>
     */
    public function imagesFor(string $propertyType, string $unitKind, int $number, bool $parking, bool $laundry): array
    {
        $images = $this->setFor($propertyType, $unitKind, $number)['images'];

        if ($parking) {
            $images[] = $this->sharedImage('parking', $number);
        }

        if ($laundry) {
            $images[] = $this->sharedImage('laundry', $number);
        }

        return $images;
    }

    /**
     * @return array{sha256: string, mime_type: string, size_bytes: int}
     */
    public function metadata(string $file): array
    {
        $path = $this->absolutePath($file);
        $mimeType = mime_content_type($path);
        $sha256 = hash_file('sha256', $path);
        $size = filesize($path);

        if (! is_string($mimeType) || ! in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            $header = file_get_contents($path, false, null, 0, 12);
            if (is_string($header) && str_starts_with($header, 'RIFF') && substr($header, 8, 4) === 'WEBP') {
                $mimeType = 'image/webp';
            } elseif (is_string($header) && str_starts_with($header, "\xFF\xD8\xFF")) {
                $mimeType = 'image/jpeg';
            }
        }

        if (! is_string($mimeType) || ! in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true) || $sha256 === false || $size === false || $size < 1) {
            throw new RuntimeException("Media library file is invalid: {$file}");
        }

        return [
            'sha256' => $sha256,
            'mime_type' => $mimeType,
            'size_bytes' => $size,
        ];
    }

    public function absolutePath(string $file): string
    {
        $relative = str_replace('/', DIRECTORY_SEPARATOR, $file);
        $candidate = $this->directory.DIRECTORY_SEPARATOR.$relative;
        $directory = realpath($this->directory);
        $absolute = realpath($candidate);

        if (
            $directory === false
            || $absolute === false
            || ! is_file($absolute)
            || ! str_starts_with($absolute, $directory.DIRECTORY_SEPARATOR)
        ) {
            throw new RuntimeException("Media library file is missing or unreadable: {$file}");
        }

        return $absolute;
    }

    /**
     * @return array{
     *     id: string,
     *     property_types: list<string>,
     *     unit_kinds: list<string>,
     *     images: list<array{file: string, storage_path: string, level: string, caption: string}>
     * }
     */
    private function setFor(string $propertyType, string $unitKind, int $number): array
    {
        $matches = array_values(array_filter(
            $this->sets,
            fn (array $set): bool => in_array($propertyType, $set['property_types'], true)
                && in_array($unitKind, $set['unit_kinds'], true),
        ));

        if ($matches === []) {
            throw new RuntimeException("No image set matches {$propertyType} / {$unitKind}.");
        }

        return $matches[($number - 1) % count($matches)];
    }

    /**
     * @return array{amenity: string, file: string, storage_path: string, level: string, caption: string}
     */
    private function sharedImage(string $amenity, int $number): array
    {
        $matches = array_values(array_filter(
            $this->shared,
            fn (array $image): bool => $image['amenity'] === $amenity,
        ));

        if ($matches === []) {
            throw new RuntimeException("No shared image exists for {$amenity}.");
        }

        return $matches[($number - 1) % count($matches)];
    }

    private function assertValid(): void
    {
        $paths = [];

        foreach ($this->images() as $image) {
            foreach (['file', 'storage_path', 'level', 'caption'] as $key) {
                if (! is_string($image[$key] ?? null) || trim($image[$key]) === '') {
                    throw new RuntimeException('A media library entry is incomplete.');
                }
            }

            if (! in_array($image['level'], ['property', 'unit'], true)) {
                throw new RuntimeException("Media library level is invalid for {$image['file']}.");
            }

            if (! $this->isLibraryPath($image['storage_path'])) {
                throw new RuntimeException("Media library storage path is invalid: {$image['storage_path']}");
            }

            if (isset($paths[$image['storage_path']])) {
                throw new RuntimeException("Media library storage path is duplicated: {$image['storage_path']}");
            }

            $paths[$image['storage_path']] = true;
            $this->absolutePath($image['file']);
        }

        if ($paths === []) {
            throw new RuntimeException('The media library manifest does not list any images.');
        }
    }

    private function isLibraryPath(string $storagePath): bool
    {
        return str_starts_with($storagePath, SharedStorageRetention::SEED_PREFIX)
            && ! str_contains($storagePath, '..')
            && preg_match('/^seed\/[A-Za-z0-9._\/-]+$/', $storagePath) === 1;
    }
}
