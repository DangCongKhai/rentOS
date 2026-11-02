<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class PublicListingFixtureTest extends TestCase
{
    use RefreshDatabase;

    public function test_published_listing_and_blocked_unit_survive_immediate_constraints(): void
    {
        $published = PublicListingFixture::published();

        // Original contracts must cover the unit minimum of 3 months.
        PublicListingFixture::blockUnit($published->unitIds[0], '2026-07-01', '2026-09-30');

        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');

        $this->assertDatabaseHas('listings', [
            'id' => $published->listingId,
            'publication_status' => 'PUBLISHED',
            'moderation_status' => 'APPROVED',
        ]);
        $this->assertDatabaseHas('units', [
            'id' => $published->unitIds[0],
            'operational_status' => 'READY',
            'is_marketed' => true,
        ]);
        $this->assertDatabaseHas('property_media', [
            'id' => $published->coverMediaId,
            'unit_id' => null,
        ]);
        $this->assertDatabaseHas('tenancies', [
            'unit_id' => $published->unitIds[0],
            'status' => 'PENDING_CONFIRMATION',
            'blocked_start_date' => '2026-07-01',
            'blocked_end_date' => '2026-09-30',
        ]);
    }
}
