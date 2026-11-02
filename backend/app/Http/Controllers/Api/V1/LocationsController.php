<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class LocationsController extends Controller
{
    public function provinces(CacheRepository $cache): JsonResponse
    {
        return $this->cachedLookup(
            $cache,
            'provinces',
            'new-provinces',
            ['limit' => 100],
        );
    }

    public function wards(string $provinceCode, CacheRepository $cache): JsonResponse
    {
        abort_unless(preg_match('/^\d{1,6}$/', $provinceCode) === 1, 404);

        return $this->cachedLookup(
            $cache,
            "wards.{$provinceCode}",
            "new-provinces/{$provinceCode}/wards",
            ['limit' => 1000],
        );
    }

    /**
     * @param  array<string, int>  $query
     */
    private function cachedLookup(
        CacheRepository $cache,
        string $cacheKey,
        string $path,
        array $query,
    ): JsonResponse {
        $data = $cache->remember("tinhthanhpho.{$cacheKey}", now()->addDay(), function () use ($path, $query): ?array {
            try {
                $response = Http::acceptJson()
                    ->baseUrl((string) config('services.tinhthanhpho.url'))
                    ->timeout(5)
                    ->get($path, $query);
            } catch (ConnectionException) {
                return null;
            }

            $payload = $response->json();

            if (! $response->successful() || ! is_array($payload) || ($payload['success'] ?? false) !== true) {
                return null;
            }

            return $payload;
        });

        if (! is_array($data)) {
            return response()->json([
                'success' => false,
                'message' => 'Location data is temporarily unavailable.',
                'data' => [],
            ], 503);
        }

        return response()->json($data)->header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    }
}
