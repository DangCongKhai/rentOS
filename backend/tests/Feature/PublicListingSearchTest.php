<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class PublicListingSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-01');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_occupied_listing_stays_in_search_with_an_available_from_label(): void
    {
        $published = PublicListingFixture::published([
            'name' => 'Nhà Hải Châu',
            'property_type' => 'APARTMENT',
            'ward' => 'Hải Châu',
            'city' => 'Đà Nẵng',
            'title' => 'Studio full nội thất gần biển Mỹ Khê',
            'units' => [
                [
                    'label' => 'Phòng 1',
                    'advertised_monthly_rent' => 3800000,
                    'minimum_rental_months' => 3,
                ],
                [
                    'label' => 'Phòng 2',
                    'advertised_monthly_rent' => 4500000,
                    'minimum_rental_months' => 3,
                ],
            ],
        ]);
        PublicListingFixture::blockUnit($published->unitIds[0], '2026-11-01', '2027-05-01');
        PublicListingFixture::blockUnit($published->unitIds[1], '2026-11-01', '2027-05-01');

        $response = $this->getJson('/api/v1/listings');

        $response->assertOk()
            ->assertJsonPath('data.0.id', $published->listingId)
            ->assertJsonPath('data.0.title', 'Studio full nội thất gần biển Mỹ Khê')
            ->assertJsonPath('data.0.availability_label', 'Trống từ 02/05/2027')
            ->assertJsonPath('data.0.available_unit_count', 0)
            ->assertJsonPath('data.0.rent_min', '3800000')
            ->assertJsonPath('data.0.rent_max', '4500000')
            ->assertJsonPath('data.0.minimum_rental_months', 3)
            ->assertJsonPath('data.0.property.name', 'Nhà Hải Châu')
            ->assertJsonPath('data.0.property.property_type', 'APARTMENT')
            ->assertJsonPath('data.0.property.ward', 'Hải Châu')
            ->assertJsonPath('data.0.property.city', 'Đà Nẵng');

        $this->assertStringStartsWith(
            'https://example.supabase.co/storage/v1/object/public/property-media/listings/',
            $response->json('data.0.cover_url'),
        );
        $this->assertSame($response->json('data.0.cover_url'), $response->json('data.0.image_urls.0'));
        $this->assertCount(3, $response->json('data.0.image_urls'));
        $this->assertArrayNotHasKey('district', $response->json('data.0.property'));
    }

    public function test_later_block_produces_available_until_label(): void
    {
        $published = PublicListingFixture::published();
        PublicListingFixture::blockUnit($published->unitIds[0], '2027-02-01', '2027-08-01');

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonPath('data.0.availability_label', 'Còn trống đến 31/01/2027')
            ->assertJsonPath('data.0.available_unit_count', 1);
    }

    public function test_location_ranks_accent_insensitive_matches_and_ignores_district_only_text(): void
    {
        $exact = PublicListingFixture::published([
            'ward' => 'Hải Châu',
            'address_line' => '12 Trần Phú',
            'city' => 'Đà Nẵng',
            'district' => 'Quận cũ',
        ]);
        $loose = PublicListingFixture::published([
            'ward' => 'Sơn Trà',
            'address_line' => '12 Hai Chauu',
            'city' => 'Đà Nẵng',
            'district' => 'Quận cũ',
        ]);
        PublicListingFixture::published([
            'ward' => 'Thanh Khê',
            'address_line' => '1 Lê Lợi',
            'city' => 'Đà Nẵng',
            'district' => 'Hải Châu',
        ]);

        $ranked = $this->getJson('/api/v1/listings?location=hai%20chau');

        $ranked->assertOk();
        $this->assertSame(
            [$exact->listingId, $loose->listingId],
            collect($ranked->json('data'))->pluck('id')->all(),
        );

        $this->getJson('/api/v1/listings?location='.urlencode('Hải Châu'))
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/v1/listings?location=zzzzqqqq')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_move_in_date_hides_a_blocked_stay_without_unpublishing_the_listing(): void
    {
        $published = PublicListingFixture::published([
            'units' => [[
                'minimum_rental_months' => 3,
            ]],
        ]);
        PublicListingFixture::blockUnit($published->unitIds[0], '2026-11-01', '2027-05-01');

        $this->getJson('/api/v1/listings?move_in_date=2026-11-01')
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('meta.result_label', '0 tin đăng còn trống từ 01/11/2026');

        $this->assertDatabaseHas('listings', [
            'id' => $published->listingId,
            'publication_status' => 'PUBLISHED',
        ]);
    }

    public function test_invalid_move_in_date_is_rejected(): void
    {
        $this->getJson('/api/v1/listings?move_in_date=not-a-date')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['move_in_date']);
    }

    public function test_amenity_catalog_is_public(): void
    {
        $this->getJson('/api/v1/amenities')
            ->assertOk()
            ->assertJsonFragment([
                'key' => 'washing_machine',
                'scope' => 'UNIT',
                'label_vi' => 'Máy giặt',
            ])
            ->assertJsonFragment([
                'key' => 'laundry',
                'scope' => 'PROPERTY',
            ]);
    }
}
