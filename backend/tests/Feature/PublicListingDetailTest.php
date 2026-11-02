<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class PublicListingDetailTest extends TestCase
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

    public function test_detail_shows_a_held_unit_and_omits_private_fields(): void
    {
        $published = PublicListingFixture::published([
            'title' => 'Studio full nội thất gần biển Mỹ Khê',
            'policies' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => ['Không hút thuốc trong nhà'],
            ],
            'shared_amenities' => PublicListingFixture::amenityDocument([
                'laundry' => ['enabled' => true, 'details' => 'Tầng trệt'],
            ]),
        ]);
        PublicListingFixture::blockUnit($published->unitIds[0], '2026-11-01', '2027-05-01');

        $response = $this->getJson('/api/v1/listings/'.$published->listingId);

        $response->assertOk()
            ->assertJsonPath('data.title', 'Studio full nội thất gần biển Mỹ Khê')
            ->assertJsonPath('data.property.shared_rules.0', 'Không hút thuốc trong nhà')
            ->assertJsonPath('data.property.shared_amenities.0.key', 'laundry')
            ->assertJsonPath('data.units.0.availability_label', 'Đã được giữ/đặt. Trống từ 02/05/2027')
            ->assertJsonPath('data.units.0.held_start', '2026-11-01')
            ->assertJsonPath('data.units.0.held_end', '2027-05-01')
            ->assertJsonMissingPath('data.property.district');

        $response->assertJsonMissing(['admin_suspended_at']);
        $encoded = $response->getContent();
        $this->assertIsString($encoded);
        $this->assertSame($published->owner->name, $response->json('data.owner.name'));
        $this->assertStringNotContainsString($published->owner->id, $encoded);
        $this->assertStringNotContainsString($published->owner->email, $encoded);
        $this->assertStringNotContainsString('storage_path', $encoded);
        $this->assertStringNotContainsString('document_sha256', $encoded);
        $this->assertStringNotContainsString('latitude', $encoded);
    }

    public function test_hidden_suspended_and_unknown_listings_are_not_found(): void
    {
        $hidden = PublicListingFixture::published([
            'publication_status' => 'HIDDEN',
            'title' => 'Tiêu đề bí mật bị ẩn',
        ]);
        $suspended = PublicListingFixture::published([
            'admin_suspended_at' => now(),
            'title' => 'Tiêu đề bí mật bị đình chỉ',
        ]);

        $this->getJson('/api/v1/listings/'.$hidden->listingId)
            ->assertNotFound()
            ->assertJsonMissing(['Tiêu đề bí mật bị ẩn']);

        $this->getJson('/api/v1/listings/'.$suspended->listingId)
            ->assertNotFound()
            ->assertJsonMissing(['Tiêu đề bí mật bị đình chỉ']);

        $this->getJson('/api/v1/listings/'.Str::uuid())
            ->assertNotFound();
    }
}
