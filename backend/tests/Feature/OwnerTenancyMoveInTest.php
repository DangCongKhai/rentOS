<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class OwnerTenancyMoveInTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_mark_move_in_after_the_confirmed_start_date_and_replay(): void
    {
        $case = $this->createConfirmedTenancy(false);
        $url = "/api/v1/owner/tenancies/{$case['tenancy']->id}/move-in";
        $payload = ['client_operation_id' => (string) Str::uuid()];

        $this->actingAs($case['listing']->owner)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.tenancy_id', $case['tenancy']->id)
            ->assertJsonPath('data.status', 'ACTIVE')
            ->assertJsonPath('data.replayed', false);

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'ACTIVE',
            'blocked_start_date' => $case['tenancy']->blocked_start_date,
            'blocked_end_date' => $case['tenancy']->blocked_end_date,
        ]);
        $this->assertNotNull(DB::table('tenancies')
            ->where('id', $case['tenancy']->id)
            ->value('moved_in_at'));

        $this->actingAs($case['listing']->owner)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'ACTIVE')
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseCount('notification_outbox', 2);
        $this->assertDatabaseCount('idempotency_records', 2);
    }

    public function test_owner_cannot_mark_move_in_before_the_confirmed_start_date(): void
    {
        $case = $this->createConfirmedTenancy(true);

        $this->actingAs($case['listing']->owner)->postJson(
            "/api/v1/owner/tenancies/{$case['tenancy']->id}/move-in",
            ['client_operation_id' => (string) Str::uuid()],
        )->assertConflict();

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'moved_in_at' => null,
        ]);

        $this->assertDatabaseMissing('audit_logs', [
            'entity_id' => $case['tenancy']->id,
            'action' => 'tenancy.moved_in',
        ]);
    }

    /**
     * @return array{listing: PublishedListing, tenancy: object}
     */
    private function createConfirmedTenancy(bool $startInFuture): array
    {
        $listing = PublicListingFixture::published();
        $unitId = $listing->unitIds[0];

        $startDate = $startInFuture
            ? now()->addDays(30)->toDateString()
            : now()->subDay()->toDateString();

        $endDate = CarbonImmutable::parse($startDate)
            ->addMonthsNoOverflow(3)
            ->subDay()
            ->toDateString();

        PublicListingFixture::blockUnit($unitId, $startDate, $endDate);

        $tenancy = DB::table('tenancies')
            ->where('unit_id', $unitId)
            ->where('status', 'PENDING_CONFIRMATION')
            ->firstOrFail();

        $contract = DB::table('tenancy_contracts')
            ->where('tenancy_id', $tenancy->id)
            ->where('id', $tenancy->pending_contract_id)
            ->firstOrFail();

        $tenant = User::query()->findOrFail($tenancy->tenant_id);

        $this->actingAs($tenant)->postJson(
            "/api/v1/tenant/tenancies/{$tenancy->id}/contracts/{$contract->id}/confirm",
            [
                'client_operation_id' => (string) Str::uuid(),
            ],
        )->assertOk();

        return [
            'listing' => $listing,
            'tenancy' => $tenancy,
        ];
    }
}
