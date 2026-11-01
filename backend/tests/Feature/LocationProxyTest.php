<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LocationProxyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_it_proxies_and_caches_province_lookups(): void
    {
        Http::fake([
            'www.tinhthanhpho.com/api/v1/new-provinces*' => Http::response([
                'success' => true,
                'data' => [['code' => '48', 'name' => 'Đà Nẵng']],
            ]),
        ]);

        $this->getJson('/api/v1/locations/provinces')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Đà Nẵng');
        $this->getJson('/api/v1/locations/provinces')
            ->assertOk()
            ->assertJsonPath('data.0.code', '48');

        Http::assertSent(fn (ClientRequest $request): bool => $request->url() === 'https://www.tinhthanhpho.com/api/v1/new-provinces?limit=100');
        Http::assertSentCount(1);
    }

    public function test_it_proxies_ward_lookups_and_rejects_invalid_province_codes(): void
    {
        Http::fake([
            'www.tinhthanhpho.com/api/v1/new-provinces/48/wards*' => Http::response([
                'success' => true,
                'data' => [['code' => '20194', 'name' => 'Phường Hải Châu']],
            ]),
        ]);

        $this->getJson('/api/v1/locations/provinces/48/wards')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Phường Hải Châu');
        $this->getJson('/api/v1/locations/provinces/not-a-code/wards')->assertNotFound();

        Http::assertSent(fn (ClientRequest $request): bool => str_contains($request->url(), '/new-provinces/48/wards?limit=1000'));
        Http::assertSentCount(1);
    }

    public function test_it_returns_a_safe_error_when_the_location_service_fails(): void
    {
        Http::fake([
            'www.tinhthanhpho.com/*' => Http::response(['success' => false], 503),
        ]);

        $this->getJson('/api/v1/locations/provinces')
            ->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('data', []);
    }
}
