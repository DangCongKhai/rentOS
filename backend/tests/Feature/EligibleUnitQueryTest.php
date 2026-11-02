<?php

namespace Tests\Feature;

use App\Domain\Discovery\EligibleUnitQuery;
use App\Domain\Discovery\ListingSearchCriteria;
use App\Domain\Discovery\LocationQuery;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class EligibleUnitQueryTest extends TestCase
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

    public function test_location_matches_ward_text_typos_and_ignores_district_and_hidden_listings(): void
    {
        $haiChau = PublicListingFixture::published([
            'ward' => 'Hải Châu',
            'address_line' => '12 Trần Phú',
            'city' => 'Đà Nẵng',
            'district' => 'Quận cũ',
        ]);
        PublicListingFixture::published([
            'ward' => 'Sơn Trà',
            'address_line' => '99 Võ Nguyên Giáp',
            'city' => 'Đà Nẵng',
            'district' => 'Sơn Trà',
        ]);
        PublicListingFixture::published([
            'ward' => 'Thanh Khê',
            'address_line' => '1 Lê Lợi',
            'city' => 'Đà Nẵng',
            'district' => 'Hải Châu',
        ]);
        PublicListingFixture::published([
            'ward' => 'Hải Châu',
            'publication_status' => 'HIDDEN',
            'title' => 'Tin ẩn Hải Châu',
        ]);

        $this->assertSame([$haiChau->listingId], $this->listingIds('  hải   châu '));
        $this->assertSame([$haiChau->listingId], $this->listingIds('hai chau'));
        $this->assertSame([$haiChau->listingId], $this->listingIds('Hải Châ'));
        $this->assertSame([], $this->listingIds('zzzzqqqq'));
    }

    public function test_exact_ward_ranks_before_a_looser_street_match(): void
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

        $this->assertSame([$exact->listingId, $loose->listingId], $this->listingIds('Hải Châu'));
    }

    public function test_occupied_unit_stays_visible_until_a_move_in_date_requires_a_free_stay(): void
    {
        $published = PublicListingFixture::published([
            'units' => [[
                'minimum_rental_months' => 3,
            ]],
        ]);
        PublicListingFixture::blockUnit($published->unitIds[0], '2026-11-01', '2027-05-01');

        $this->assertSame([$published->listingId], $this->listingIds(null));

        $blocked = $this->criteria(location: null, moveInDate: '2026-11-01');
        $this->assertSame([], $this->listingIdsFor($blocked, requireFree: true));

        $later = PublicListingFixture::published([
            'units' => [[
                'minimum_rental_months' => 3,
                'label' => 'Phòng sau',
            ]],
        ]);
        PublicListingFixture::blockUnit($later->unitIds[0], '2027-02-01', '2027-05-01');

        $this->assertSame([$later->listingId], $this->listingIdsFor($blocked, requireFree: true));
    }

    public function test_price_and_kind_must_match_the_same_unit(): void
    {
        PublicListingFixture::published([
            'units' => [
                [
                    'label' => 'Phòng rẻ',
                    'unit_kind' => 'ROOM',
                    'advertised_monthly_rent' => 3500000,
                ],
                [
                    'label' => 'Studio đắt',
                    'unit_kind' => 'STUDIO',
                    'advertised_monthly_rent' => 6000000,
                ],
            ],
        ]);

        $criteria = $this->criteria(location: null, maxRent: 4000000, unitKind: 'STUDIO');

        $this->assertSame([], $this->listingIdsFor($criteria));
    }

    public function test_shared_laundry_and_custom_text_do_not_match_an_in_unit_washing_machine(): void
    {
        PublicListingFixture::published([
            'shared_amenities' => PublicListingFixture::amenityDocument([
                'laundry' => ['enabled' => true],
            ]),
            'units' => [[
                'amenities' => PublicListingFixture::amenityDocument([], ['Máy giặt riêng']),
            ]],
        ]);

        $criteria = $this->criteria(location: null, amenityKeys: ['washing_machine']);

        $this->assertSame([], $this->listingIdsFor($criteria));
    }

    public function test_unit_pet_override_wins_over_the_property_policy(): void
    {
        $published = PublicListingFixture::published([
            'policies' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => [],
            ],
            'units' => [[
                'policy_overrides' => ['pets' => 'ALLOWED'],
            ]],
        ]);

        $criteria = $this->criteria(location: null, pets: 'ALLOWED');

        $this->assertSame([$published->listingId], $this->listingIdsFor($criteria));
    }

    public function test_one_unit_can_satisfy_rent_washing_machine_and_pets_together(): void
    {
        $published = PublicListingFixture::published([
            'ward' => 'Hải Châu',
            'policies' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => [],
            ],
            'shared_amenities' => PublicListingFixture::amenityDocument([
                'laundry' => ['enabled' => true],
            ]),
            'units' => [
                [
                    'label' => 'Phòng A',
                    'advertised_monthly_rent' => 3500000,
                    'policy_overrides' => ['pets' => 'NOT_ALLOWED'],
                ],
                [
                    'label' => 'Phòng B',
                    'advertised_monthly_rent' => 4200000,
                    'amenities' => PublicListingFixture::amenityDocument([
                        'washing_machine' => ['enabled' => true],
                    ]),
                    'policy_overrides' => ['pets' => 'ALLOWED'],
                ],
            ],
        ]);
        PublicListingFixture::blockUnit($published->unitIds[0], '2026-11-01', '2027-05-01');

        $criteria = $this->criteria(
            location: 'Hải Châu',
            maxRent: 5000000,
            amenityKeys: ['washing_machine'],
            pets: 'ALLOWED',
        );

        $this->assertSame([$published->listingId], $this->listingIdsFor($criteria));
    }

    public function test_ineligible_units_and_listings_are_excluded(): void
    {
        $maintenance = PublicListingFixture::published([
            'ward' => 'Cẩm Lệ',
            'units' => [[
                'operational_status' => 'MAINTENANCE',
                'is_marketed' => true,
            ]],
        ]);
        $unmarketed = PublicListingFixture::published([
            'ward' => 'Cẩm Lệ',
            'units' => [[
                'is_marketed' => false,
            ]],
        ]);
        $draft = PublicListingFixture::published([
            'ward' => 'Cẩm Lệ',
            'publication_status' => 'DRAFT',
            'moderation_status' => 'DRAFT',
        ]);
        $suspended = PublicListingFixture::published([
            'ward' => 'Cẩm Lệ',
            'admin_suspended_at' => now(),
        ]);

        $ids = $this->listingIds('Cẩm Lệ');

        $this->assertNotContains($maintenance->listingId, $ids);
        $this->assertNotContains($unmarketed->listingId, $ids);
        $this->assertNotContains($draft->listingId, $ids);
        $this->assertNotContains($suspended->listingId, $ids);
    }

    /**
     * @return list<string>
     */
    private function listingIds(?string $location): array
    {
        return $this->listingIdsFor($this->criteria(location: $location));
    }

    /**
     * @return list<string>
     */
    private function listingIdsFor(ListingSearchCriteria $criteria, bool $requireFree = false): array
    {
        $query = Unit::query()->select('discovery_listings.id as listing_id');
        EligibleUnitQuery::apply($query, $criteria, $requireFree);

        return $query->pluck('listing_id')->map(fn ($id): string => (string) $id)->all();
    }

    /**
     * @param  list<string>  $amenityKeys
     */
    private function criteria(
        ?string $location,
        ?string $moveInDate = null,
        ?int $maxRent = null,
        ?string $unitKind = null,
        array $amenityKeys = [],
        ?string $pets = null,
    ): ListingSearchCriteria {
        return new ListingSearchCriteria(
            location: LocationQuery::fromInput($location),
            moveInDate: $moveInDate,
            minRent: null,
            maxRent: $maxRent,
            unitKind: $unitKind,
            bedrooms: null,
            bathrooms: null,
            occupants: null,
            amenityKeys: $amenityKeys,
            pets: $pets,
            page: 1,
            perPage: 12,
        );
    }
}
