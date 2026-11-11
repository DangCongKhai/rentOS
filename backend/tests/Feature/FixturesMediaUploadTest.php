<?php

namespace Tests\Feature;

use Database\Seeders\SeedImageLibrary;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FixturesMediaUploadTest extends TestCase
{
    public function test_upload_sends_each_library_object_once_when_it_is_missing(): void
    {
        $this->configureStorage();
        Http::preventStrayRequests();
        Http::fake([
            'https://example.supabase.co/storage/v1/object/info/*' => Http::response(['message' => 'not found'], 404),
            'https://example.supabase.co/storage/v1/object/*' => Http::response(['Key' => 'ok'], 200),
        ]);

        $imageCount = count(SeedImageLibrary::load()->images());

        $this->artisan('fixtures:media-upload')
            ->assertSuccessful()
            ->expectsOutputToContain("Uploaded {$imageCount} seed library objects and skipped 0 existing objects.")
            ->doesntExpectOutputToContain('service-role-test');

        Http::assertSentCount($imageCount * 2);
    }

    public function test_upload_skips_library_objects_that_already_exist(): void
    {
        $this->configureStorage();
        Http::preventStrayRequests();
        Http::fake([
            'https://example.supabase.co/storage/v1/object/info/*' => Http::response(['name' => 'image.png'], 200),
        ]);

        $imageCount = count(SeedImageLibrary::load()->images());

        $this->artisan('fixtures:media-upload')
            ->assertSuccessful()
            ->expectsOutputToContain("Uploaded 0 seed library objects and skipped {$imageCount} existing objects.");

        Http::assertSentCount($imageCount);
        Http::assertNotSent(fn ($request): bool => $request->method() === 'POST');
    }

    public function test_overwrite_replaces_existing_library_objects(): void
    {
        $this->configureStorage();
        Http::preventStrayRequests();
        Http::fake([
            'https://example.supabase.co/storage/v1/object/info/*' => Http::response(['name' => 'image.png'], 200),
            'https://example.supabase.co/storage/v1/object/*' => Http::response(['Key' => 'ok'], 200),
        ]);

        $this->artisan('fixtures:media-upload', ['--overwrite' => true])->assertSuccessful();

        Http::assertSent(fn ($request): bool => $request->method() === 'POST' && $request->hasHeader('x-upsert', 'true'));
    }

    public function test_upload_stops_when_an_existing_object_has_a_different_size(): void
    {
        $this->configureStorage();
        Http::preventStrayRequests();
        Http::fake([
            'https://example.supabase.co/storage/v1/object/info/*' => Http::response(['size' => 1], 200),
        ]);

        $this->artisan('fixtures:media-upload')
            ->assertFailed()
            ->expectsOutputToContain('does not match the local library');
    }

    public function test_upload_refuses_production(): void
    {
        $this->app['env'] = 'production';
        Http::preventStrayRequests();

        $this->artisan('fixtures:media-upload')->assertFailed();
    }

    private function configureStorage(): void
    {
        config([
            'services.supabase.url' => 'https://example.supabase.co',
            'services.supabase.service_role_key' => 'service-role-test',
            'services.supabase.storage.bucket' => 'property-media',
        ]);
    }
}
