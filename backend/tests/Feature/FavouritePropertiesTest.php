<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class FavouritePropertiesTest extends TestCase
{
    use RefreshDatabase;

    private const string PATH = '/api/v1/favourite-properties';

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_save_and_remove_are_idempotent_and_private_by_property(): void
    {
        $listing = PublicListingFixture::published();
        $user = User::factory()->create();
        $path = self::PATH.'/'.$listing->propertyId;

        $this->putJson($path)->assertUnauthorized();
        $this->getJson(self::PATH.'/ids')->assertUnauthorized();
        $this->actingAs($user, 'web')->putJson($path)->assertCreated();
        $this->putJson($path)->assertOk()->assertExactJson(['data' => ['property_id' => $listing->propertyId]]);
        $this->assertDatabaseCount('favourite_properties', 1);
        $this->getJson(self::PATH.'/ids')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertExactJson(['data' => ['ids' => [$listing->propertyId], 'count' => 1]]);
        $this->getJson(self::PATH.'?search=Studio')->assertOk()->assertJsonPath('data.items.0.listing.id', $listing->listingId)
            ->assertJsonPath('data.items.0.listing.property_id', $listing->propertyId);

        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->getJson(self::PATH.'/count')->assertOk()
            ->assertExactJson(['data' => ['count' => 0]]);
        $this->getJson(self::PATH, ['X-Favourites-Account' => $user->id])->assertConflict();
        $this->putJson($path, [], ['X-Favourites-Account' => $user->id])->assertConflict();
        $this->deleteJson($path)->assertNoContent();
        $this->assertDatabaseHas('favourite_properties', ['user_id' => $user->id, 'property_id' => $listing->propertyId]);

        Auth::forgetGuards();
        $this->actingAs($user, 'web')->deleteJson($path)->assertNoContent();
        $this->deleteJson($path)->assertNoContent();
        $this->assertDatabaseCount('favourite_properties', 0);
        $this->assertDatabaseCount('rental_requests', 0);
        $this->assertDatabaseCount('tenancies', 0);
    }

    public function test_unpublished_properties_are_generic_removable_placeholders(): void
    {
        $listing = PublicListingFixture::published(['title' => 'Tiêu đề riêng']);
        $user = User::factory()->create();
        $path = self::PATH.'/'.$listing->propertyId;
        $this->actingAs($user, 'web')->putJson($path)->assertCreated();

        DB::table('listings')->where('id', $listing->listingId)->update(['publication_status' => 'HIDDEN']);
        $this->getJson(self::PATH)->assertOk()
            ->assertExactJson(['data' => [
                'items' => [['property_id' => $listing->propertyId, 'listing' => null]], 'page' => 1, 'last_page' => 1, 'total' => 1,
            ]]);
        $this->getJson(self::PATH.'?search=riêng')->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson(self::PATH.'/count')->assertOk()->assertJsonPath('data.count', 1);
        $this->putJson($path)->assertOk();
        $this->deleteJson($path)->assertNoContent();
        $this->putJson($path)->assertNotFound();
    }

    public function test_a_booked_date_does_not_hide_or_remove_the_saved_listing(): void
    {
        $listing = PublicListingFixture::published();
        $this->actingAs(User::factory()->create(), 'web')->putJson(self::PATH.'/'.$listing->propertyId)->assertCreated();
        PublicListingFixture::blockUnit($listing->unitIds[0], '2027-01-01', '2027-06-30');

        $this->getJson(self::PATH.'?move_in_date=2027-01-01')->assertOk()
            ->assertJsonPath('data.items.0.listing.id', $listing->listingId)
            ->assertJsonPath('data.items.0.listing.available_unit_count', 0);
        $this->assertDatabaseCount('favourite_properties', 1);
    }

    public function test_token_abilities_are_checked_per_action(): void
    {
        $listing = PublicListingFixture::published();
        $user = User::factory()->create();
        $read = $user->createToken('Read favourites', ['favourites:read'], now()->addHour())->plainTextToken;
        $write = $user->createToken('Write favourites', ['favourites:write'], now()->addHour())->plainTextToken;
        $path = self::PATH.'/'.$listing->propertyId;

        $this->withToken($read)->getJson(self::PATH)->assertOk();
        $this->putJson($path)->assertForbidden();
        $this->deleteJson($path)->assertForbidden();

        Auth::forgetGuards();
        $this->withToken($write)->putJson($path)->assertCreated();
        $this->getJson(self::PATH.'/ids')->assertForbidden();
        $this->deleteJson($path)->assertNoContent();
    }

    public function test_browser_can_send_the_account_guard_header(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:3000']]);
        $listing = PublicListingFixture::published();
        $response = $this->optionsJson(self::PATH.'/'.$listing->propertyId, [], [
            'Origin' => 'http://localhost:3000',
            'Access-Control-Request-Method' => 'PUT',
            'Access-Control-Request-Headers' => 'x-favourites-account,x-xsrf-token',
        ])->assertNoContent()->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

        $this->assertStringContainsString('x-favourites-account', strtolower($response->headers->get('Access-Control-Allow-Headers', '')));
    }

    public function test_list_paginates_saved_properties_and_keeps_the_overall_count(): void
    {
        $user = User::factory()->create();
        $items = [];
        foreach (range(1, 13) as $index) {
            $listing = PublicListingFixture::published(['title' => 'Căn hộ '.$index]);
            $items[] = [
                'user_id' => $user->id,
                'property_id' => $listing->propertyId,
                'created_at' => now()->addMinutes($index),
            ];
        }
        DB::table('favourite_properties')->insert($items);

        $this->actingAs($user, 'web')->getJson(self::PATH.'?page=2&sort=oldest')->assertOk()
            ->assertJsonCount(1, 'data.items')->assertJsonPath('data.last_page', 2)
            ->assertJsonPath('data.items.0.property_id', $items[12]['property_id']);
        $this->getJson(self::PATH.'?search=13')->assertOk()->assertJsonPath('data.total', 1);
        $this->getJson(self::PATH.'/count')->assertOk()->assertJsonPath('data.count', 13);
    }
}
