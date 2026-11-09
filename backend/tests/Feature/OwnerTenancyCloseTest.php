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

class OwnerTenancyCloseTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_cancel_a_confirmed_tenancy_before_its_start_and_replay(): void
    {
        $case = $this->createConfirmedTenancy(true);
        $url = "/api/v1/owner/tenancies/{$case['tenancy']->id}/cancel";
        $payload = [
            'client_operation_id' => (string) Str::uuid(),
            'reason' => 'The tenant and owner agreed to cancel.',
        ];

        $this->actingAs($case['listing']->owner)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'CANCELLED')
            ->assertJsonPath('data.end_reason', $payload['reason'])
            ->assertJsonPath('data.replayed', false);

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CANCELLED',
            'end_reason' => $payload['reason'],
            'blocked_start_date' => null,
            'blocked_end_date' => null,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertNotNull(DB::table('tenancies')
            ->where('id', $case['tenancy']->id)
            ->value('actual_ended_at'));

        $this->assertDatabaseHas('rental_requests', [
            'id' => $case['tenancy']->rental_request_id,
            'status' => 'ACCEPTED',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_id' => $case['tenancy']->id,
            'action' => 'tenancy.cancelled',
        ]);
        $this->assertDatabaseHas('notification_outbox', [
            'recipient_id' => $case['tenancy']->tenant_id,
            'event_type' => 'tenancy.cancelled',
        ]);

        $this->actingAs($case['listing']->owner)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.replayed', true);
    }

    public function test_owner_cannot_cancel_a_confirmed_tenancy_on_or_after_its_start(): void
    {
        $case = $this->createConfirmedTenancy(false);

        $this->actingAs($case['listing']->owner)->postJson(
            "/api/v1/owner/tenancies/{$case['tenancy']->id}/cancel",
            [
                'client_operation_id' => (string) Str::uuid(),
                'reason' => 'The tenant and owner agreed to cancel.',
            ],
        )->assertConflict();

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'actual_ended_at' => null,
            'blocked_start_date' => $case['tenancy']->blocked_start_date,
            'blocked_end_date' => $case['tenancy']->blocked_end_date,
        ]);
    }

    public function test_owner_can_end_an_active_tenancy_and_replay(): void
    {
        $case = $this->createConfirmedTenancy(false);

        $this->actingAs($case['listing']->owner)->postJson(
            "/api/v1/owner/tenancies/{$case['tenancy']->id}/move-in",
            ['client_operation_id' => (string) Str::uuid()],
        )->assertOk();

        $url = "/api/v1/owner/tenancies/{$case['tenancy']->id}/end";
        $payload = [
            'client_operation_id' => (string) Str::uuid(),
            'reason' => 'The tenant moved out earlier than planned.',
        ];

        $this->actingAs($case['listing']->owner)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'ENDED')
            ->assertJsonPath('data.end_reason', $payload['reason'])
            ->assertJsonPath('data.replayed', false);

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'ENDED',
            'end_reason' => $payload['reason'],
            'blocked_start_date' => null,
            'blocked_end_date' => null,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertNotNull(DB::table('tenancies')
            ->where('id', $case['tenancy']->id)
            ->value('actual_ended_at'));
        $this->assertNotNull(DB::table('tenancies')
            ->where('id', $case['tenancy']->id)
            ->value('moved_in_at'));

        $this->assertDatabaseHas('rental_requests', [
            'id' => $case['tenancy']->rental_request_id,
            'status' => 'ACCEPTED',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_id' => $case['tenancy']->id,
            'action' => 'tenancy.ended',
        ]);

        $this->actingAs($case['listing']->owner)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.replayed', true);
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
