<?php

namespace App\Domain\Tenancies;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

final class ContractDocumentStorage
{
    /**
     * @return array{path: string, sha256: string}
     */
    public function upload(UploadedFile $file, string $tenancyId, string $contractId): array
    {
        $baseUrl = rtrim((string) config('services.supabase.url'), '/');
        $serviceRoleKey = (string) config('services.supabase.service_role_key');
        $bucket = trim((string) config('services.supabase.contracts.bucket'));
        $path = "tenancies/{$tenancyId}/contracts/{$contractId}.pdf";
        $sha256 = hash_file('sha256', $file->getRealPath());

        if ($baseUrl === '' || $serviceRoleKey === '' || $bucket === '') {
            throw new RuntimeException('Private contract storage is not configured.');
        }

        if ($sha256 === false) {
            throw new RuntimeException('Could not calculate the agreement document hash.');
        }

        $url = $this->objectUrl($baseUrl, $bucket, $path);

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
                'x-upsert' => 'false',
            ])
                ->connectTimeout((int) config('services.supabase.storage.connect_timeout', 5))
                ->timeout((int) config('services.supabase.storage.timeout', 30))
                ->withBody($file->getContent(), 'application/pdf')
                ->post($url);
        } catch (ConnectionException $exception) {
            throw new RuntimeException(
                'Private contract storage is unavailable.',
                previous: $exception,
            );
        }

        if (! $response->successful()) {
            Log::warning('Supabase rejected a private contract document upload.', [
                'status' => $response->status(),
                'bucket' => $bucket,
                'path' => $path,
            ]);

            throw new RuntimeException('Private contract storage rejected the document.');
        }

        return [
            'path' => $path,
            'sha256' => $sha256,
        ];
    }

    public function delete(string $path): void
    {
        $baseUrl = rtrim((string) config('services.supabase.url'), '/');
        $serviceRoleKey = (string) config('services.supabase.service_role_key');
        $bucket = trim((string) config('services.supabase.contracts.bucket'));

        if ($baseUrl === '' || $serviceRoleKey === '' || $bucket === '') {
            Log::warning('Could not clean up a contract document because storage is not configured.');

            return;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
            ])
                ->connectTimeout((int) config('services.supabase.storage.connect_timeout', 5))
                ->timeout((int) config('services.supabase.storage.timeout', 30))
                ->delete(
                    $baseUrl.'/storage/v1/object/'.rawurlencode($bucket),
                    ['prefixes' => [$path]],
                );
        } catch (ConnectionException $exception) {
            Log::warning('Could not clean up a contract document after failure.', [
                'path' => $path,
                'error' => $exception->getMessage(),
            ]);

            return;
        }

        if (! $response->successful()) {
            Log::warning('Supabase rejected contract document cleanup.', [
                'status' => $response->status(),
                'bucket' => $bucket,
                'path' => $path,
            ]);
        }
    }

    private function objectUrl(string $baseUrl, string $bucket, string $path): string
    {
        $encodedPath = implode(
            '/',
            array_map(rawurlencode(...), explode('/', $path)),
        );

        return $baseUrl
            .'/storage/v1/object/'
            .rawurlencode($bucket)
            .'/'.$encodedPath;
    }
}