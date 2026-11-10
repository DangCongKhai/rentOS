<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class TenancyParticipantApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_and_tenant_can_list_and_view_their_pending_tenancy(): void
    {
        $case = $this->createPendingTenancy();

        $this->actingAs($case['tenant'])->getJson('/api/v1/tenant/tenancies')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $case['tenancy']->id)
            ->assertJsonPath('data.0.status', 'PENDING_CONFIRMATION')
            ->assertJsonPath('data.0.rental_request_status', 'ACCEPTED');

        $this->actingAs($case['listing']->owner)->getJson('/api/v1/owner/tenancies')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $case['tenancy']->id)
            ->assertJsonPath('data.0.counterparty_name', $case['tenant']->name);

        $this->actingAs($case['tenant'])->getJson(
            "/api/v1/tenant/tenancies/{$case['tenancy']->id}",
        )->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.tenancy.id', $case['tenancy']->id);

        $this->actingAs($case['listing']->owner)->getJson(
            "/api/v1/owner/tenancies/{$case['tenancy']->id}",
        )->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.tenancy.id', $case['tenancy']->id);
    }

    public function test_unrelated_user_cannot_view_tenancy_details(): void
    {
        $case = $this->createPendingTenancy();
        $unrelatedUser = User::factory()->create();

        $this->actingAs($unrelatedUser)->getJson(
            "/api/v1/tenant/tenancies/{$case['tenancy']->id}",
        )->assertNotFound();

        $this->actingAs($unrelatedUser)->getJson(
            "/api/v1/owner/tenancies/{$case['tenancy']->id}",
        )->assertNotFound();
    }

    /**
     * @return array{
     *     listing: PublishedListing,
     *     tenancy: object,
     *     tenant: User
     * }
     */
    private function createPendingTenancy(): array
    {
        $listing = PublicListingFixture::published();
        $unitId = $listing->unitIds[0];
        $startDate = now()->addDays(30)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)
            ->addMonthsNoOverflow(3)
            ->subDay()
            ->toDateString();

        PublicListingFixture::blockUnit($unitId, $startDate, $endDate);

        $tenancy = DB::table('tenancies')
            ->where('unit_id', $unitId)
            ->where('status', 'PENDING_CONFIRMATION')
            ->firstOrFail();

        return [
            'listing' => $listing,
            'tenancy' => $tenancy,
            'tenant' => User::query()->findOrFail($tenancy->tenant_id),
        ];
    }
}
