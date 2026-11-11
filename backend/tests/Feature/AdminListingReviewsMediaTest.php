<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\CreatesListingReviewPackages;
use Tests\TestCase;

class AdminListingReviewsMediaTest extends TestCase
{
    use CreatesListingReviewPackages, RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertReviewDatabaseIsIsolated();
    }

    public function test_media_returns_401_without_an_authenticated_session(): void
    {
        $package = $this->createReviewPackage();
        $path = $this->mediaPath($package['listing_id'], $package['shared_media_id']);
        Http::preventStrayRequests();

        $this->getJson($path)->assertUnauthorized();

        Http::assertNothingSent();
    }

    public function test_media_returns_403_for_a_normal_user(): void
    {
        $package = $this->createReviewPackage();
        Http::preventStrayRequests();

        $this->actingAs(User::factory()->create(), 'web')->getJson($this->mediaPath($package['listing_id'], $package['shared_media_id']))->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_media_returns_404_for_a_photo_from_another_property(): void
    {
        $package = $this->createReviewPackage();
        $other = $this->createReviewPackage();
        Http::preventStrayRequests();

        $this->actingAs(User::factory()->create(['is_admin' => true]), 'web')->getJson($this->mediaPath($package['listing_id'], $other['shared_media_id']))->assertNotFound();

        Http::assertNothingSent();
    }

    public function test_unselected_media_is_not_readable_even_for_an_admin(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $mediaId = (string) Str::uuid();
        $this->insertReviewMedia($package['property_id'], $mediaId, $package['owner']->id, selected: false);
        Http::preventStrayRequests();

        $this->actingAs($admin, 'web')->getJson($this->mediaPath($package['listing_id'], $mediaId))->assertNotFound();

        Http::assertNothingSent();
    }

    public function test_local_fixture_serves_matching_bytes_with_private_cache_and_nosniff(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $bytes = file_get_contents(database_path('seeders/fixtures/media/published-property-gallery-01.png'));
        DB::table('property_media')->where('id', $package['shared_media_id'])->update(['sha256' => hash('sha256', $bytes)]);
        config(['services.supabase.url' => null, 'services.supabase.service_role_key' => null]);
        Http::preventStrayRequests();

        $response = $this->actingAs($admin, 'web')->get($this->mediaPath($package['listing_id'], $package['shared_media_id']));

        $response->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertSame($bytes, $response->getContent());
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        Http::assertNothingSent();
    }

    public function test_remote_storage_returns_only_hash_matching_bytes(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $bytes = file_get_contents(database_path('seeders/fixtures/media/published-property-gallery-01.png'));
        DB::table('property_media')->where('id', $package['shared_media_id'])->update(['sha256' => hash('sha256', $bytes)]);
        config(['services.supabase.url' => 'https://storage.example.test', 'services.supabase.service_role_key' => 'fixture-service-key']);
        Http::preventStrayRequests();
        Http::fake(['https://storage.example.test/storage/v1/object/authenticated/property-media/*' => Http::response($bytes, 200)]);

        $response = $this->actingAs($admin, 'web')->get($this->mediaPath($package['listing_id'], $package['shared_media_id']));

        $response->assertOk();
        $this->assertSame($bytes, $response->getContent());
        Http::assertSent(fn (Request $request): bool => $request->hasHeader('Authorization', 'Bearer fixture-service-key') && $request->hasHeader('apikey', 'fixture-service-key'));
    }

    #[DataProvider('remoteFailures')]
    public function test_remote_storage_failure_does_not_fall_back_to_local_fixture(string $failure): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $bytes = file_get_contents(database_path('seeders/fixtures/media/published-property-gallery-01.png'));
        DB::table('property_media')->where('id', $package['shared_media_id'])->update(['sha256' => hash('sha256', $bytes)]);
        config(['services.supabase.url' => 'https://storage.example.test', 'services.supabase.service_role_key' => 'fixture-service-key']);
        Http::preventStrayRequests();
        $stub = match ($failure) {
            'timeout' => Http::failedConnection('Controlled timeout'),
            'redirect' => Http::response('', 302, ['Location' => 'https://another.example.test/object']),
            'hash mismatch' => Http::response('Wrong image bytes', 200),
            default => Http::response('Provider unavailable', 500),
        };
        Http::fake(['https://storage.example.test/storage/v1/object/authenticated/property-media/*' => $stub]);

        $this->actingAs($admin, 'web')->getJson($this->mediaPath($package['listing_id'], $package['shared_media_id']))->assertStatus(503);

        Http::assertSentCount(1);
    }

    public static function remoteFailures(): array
    {
        return ['timeout' => ['timeout'], 'provider error' => ['provider error'], 'redirect' => ['redirect'], 'hash mismatch' => ['hash mismatch']];
    }

    public function test_partial_remote_configuration_returns_503_without_using_local_fixture(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        config(['services.supabase.url' => 'https://storage.example.test', 'services.supabase.service_role_key' => null]);
        Http::preventStrayRequests();

        $this->actingAs($admin, 'web')->getJson($this->mediaPath($package['listing_id'], $package['shared_media_id']))->assertStatus(503);

        Http::assertNothingSent();
    }

    private function mediaPath(string $listingId, string $mediaId): string
    {
        return '/api/v1/admin/listing-reviews/'.$listingId.'/media/'.$mediaId;
    }
}
