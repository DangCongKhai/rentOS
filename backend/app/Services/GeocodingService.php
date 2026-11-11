<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class GeocodingService
{
    /**
     * @return array{latitude: float, longitude: float}|null
     */
    public function geocode(?string $addressLine, ?string $ward, ?string $city): ?array
    {
        if (! config('services.nominatim.enabled')) {
            return null;
        }

        $query = collect([$addressLine, $ward, $city, 'Vietnam'])
            ->map(fn (mixed $part): string => is_string($part) ? trim($part) : '')
            ->filter(fn (string $part): bool => $part !== '')
            ->implode(', ');

        if ($query === '' || $query === 'Vietnam') {
            return null;
        }

        $cacheKey = 'geocode:'.hash('sha256', mb_strtolower($query));
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['latitude'], $cached['longitude'])) {
            return [
                'latitude' => (float) $cached['latitude'],
                'longitude' => (float) $cached['longitude'],
            ];
        }

        try {
            $response = Http::timeout((int) config('services.nominatim.timeout', 5))
                ->withHeaders([
                    'User-Agent' => (string) config('services.nominatim.user_agent'),
                    'Accept' => 'application/json',
                ])
                ->get((string) config('services.nominatim.url'), [
                    'q' => $query,
                    'format' => 'jsonv2',
                    'limit' => 1,
                    'countrycodes' => 'vn',
                ]);

            if (! $response->ok()) {
                return null;
            }

            $first = $response->json()[0] ?? null;
            if (! is_array($first) || ! isset($first['lat'], $first['lon'])) {
                return null;
            }

            $coordinates = [
                'latitude' => (float) $first['lat'],
                'longitude' => (float) $first['lon'],
            ];
            Cache::put($cacheKey, $coordinates, now()->addDays(30));

            return $coordinates;
        } catch (Throwable $exception) {
            Log::warning('Geocoding failed', ['message' => $exception->getMessage()]);

            return null;
        }
    }
}
