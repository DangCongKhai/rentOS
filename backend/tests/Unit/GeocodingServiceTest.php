<?php

namespace Tests\Unit;

use App\Services\GeocodingService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GeocodingServiceTest extends TestCase
{
    public function test_it_returns_coordinates_from_nominatim_and_caches_them(): void
    {
        config(['services.nominatim.enabled' => true]);
        Cache::flush();
        Http::fake([
            'https://nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '16.0544', 'lon' => '108.2022'],
            ]),
        ]);

        $service = new GeocodingService;
        $first = $service->geocode('12 Trần Phú', 'Hải Châu', 'Đà Nẵng');
        $second = $service->geocode('12 Trần Phú', 'Hải Châu', 'Đà Nẵng');

        $this->assertSame(['latitude' => 16.0544, 'longitude' => 108.2022], $first);
        $this->assertSame($first, $second);
        Http::assertSentCount(1);
    }

    public function test_it_returns_null_when_geocoding_is_disabled(): void
    {
        config(['services.nominatim.enabled' => false]);
        Http::fake();

        $this->assertNull((new GeocodingService)->geocode('12 Trần Phú', 'Hải Châu', 'Đà Nẵng'));
        Http::assertNothingSent();
    }
}
