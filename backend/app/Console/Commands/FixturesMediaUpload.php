<?php

namespace App\Console\Commands;

use App\Domain\Media\SharedStorageRetention;
use Database\Seeders\SeedImageLibrary;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

#[Signature('fixtures:media-upload {--overwrite : Replace seed library objects that already exist}')]
#[Description('Upload the shared seed image library once to the public Supabase Storage bucket')]
class FixturesMediaUpload extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (! app()->environment(['local', 'development', 'staging', 'testing'])) {
            $this->components->error(
                'Media fixtures may only be uploaded in local, development, staging, or testing.',
            );

            return self::FAILURE;
        }

        $supabaseUrl = $this->requiredConfiguration(
            'services.supabase.url',
            'SUPABASE_URL',
        );
        $serviceRoleKey = $this->requiredConfiguration(
            'services.supabase.service_role_key',
            'SUPABASE_SERVICE_ROLE_KEY',
        );
        $bucket = $this->requiredConfiguration(
            'services.supabase.storage.bucket',
            'SUPABASE_STORAGE_BUCKET',
        );

        if ($supabaseUrl === null || $serviceRoleKey === null || $bucket === null) {
            return self::FAILURE;
        }

        if (! preg_match('/^[A-Za-z0-9._-]+$/', $bucket)) {
            $this->components->error('SUPABASE_STORAGE_BUCKET contains unsupported characters.');

            return self::FAILURE;
        }

        try {
            $library = SeedImageLibrary::load();
        } catch (\RuntimeException $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }

        $uploaded = 0;
        $skipped = 0;

        foreach ($library->images() as $image) {
            if (! str_starts_with($image['storage_path'], SharedStorageRetention::SEED_PREFIX)) {
                $this->components->error("Refusing to upload outside the seed library: {$image['storage_path']}.");

                return self::FAILURE;
            }

            $metadata = $library->metadata($image['file']);
            $encodedPath = $this->encodeStoragePath($image['storage_path']);
            $infoUrl = rtrim($supabaseUrl, '/').'/storage/v1/object/info/'
                .rawurlencode($bucket).'/'.$encodedPath;

            try {
                $info = $this->request($serviceRoleKey)->get($infoUrl);
            } catch (ConnectionException) {
                $this->components->error("Storage connection failed for {$image['storage_path']}.");

                return self::FAILURE;
            }

            $exists = $this->objectExists($info, $image['storage_path'], $metadata['size_bytes']);

            if ($exists === null) {
                return self::FAILURE;
            }

            if ($exists && ! $this->option('overwrite')) {
                $skipped++;

                continue;
            }

            $bytes = file_get_contents($library->absolutePath($image['file']));

            if ($bytes === false) {
                $this->components->error("Fixture file is unreadable: {$image['file']}.");

                return self::FAILURE;
            }

            $uploadUrl = rtrim($supabaseUrl, '/').'/storage/v1/object/'
                .rawurlencode($bucket).'/'.$encodedPath;

            try {
                $response = $this->request($serviceRoleKey)
                    ->withHeaders(['x-upsert' => $this->option('overwrite') ? 'true' : 'false'])
                    ->withBody($bytes, $metadata['mime_type'])
                    ->post($uploadUrl);
            } catch (ConnectionException) {
                $this->components->error("Storage connection failed for {$image['storage_path']}.");

                return self::FAILURE;
            }

            if (! $response->successful()) {
                $this->components->error(
                    "Storage upload failed with HTTP {$response->status()} for {$image['storage_path']}.",
                );

                return self::FAILURE;
            }

            $uploaded++;
        }

        $this->components->info("Uploaded {$uploaded} seed library objects and skipped {$skipped} existing objects.");

        return self::SUCCESS;
    }

    private function requiredConfiguration(string $key, string $environmentName): ?string
    {
        $value = config($key);

        if (! is_string($value) || trim($value) === '') {
            $this->components->error("{$environmentName} is required.");

            return null;
        }

        return trim($value);
    }

    private function request(string $serviceRoleKey): PendingRequest
    {
        return Http::withHeaders([
            'Authorization' => 'Bearer '.$serviceRoleKey,
            'apikey' => $serviceRoleKey,
        ])
            ->connectTimeout((int) config('services.supabase.storage.connect_timeout', 5))
            ->timeout((int) config('services.supabase.storage.timeout', 30));
    }

    /**
     * @return bool|null True when the object exists, false when it is missing, null when the lookup failed.
     */
    private function objectExists(Response $info, string $storagePath, int $sizeBytes): ?bool
    {
        if ($info->successful()) {
            $remoteSize = $info->json('size');

            if (is_numeric($remoteSize) && (int) $remoteSize !== $sizeBytes && ! $this->option('overwrite')) {
                $this->components->error(
                    "Existing object {$storagePath} does not match the local library. Re-run with --overwrite to replace it.",
                );

                return null;
            }

            return true;
        }

        if (in_array($info->status(), [400, 404], true)) {
            return false;
        }

        $this->components->error(
            "Storage lookup failed with HTTP {$info->status()} for {$storagePath}.",
        );

        return null;
    }

    private function encodeStoragePath(string $storagePath): string
    {
        return implode('/', array_map(rawurlencode(...), explode('/', $storagePath)));
    }
}
