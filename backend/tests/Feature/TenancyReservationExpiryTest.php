<?php

namespace Tests\Feature;

use App\Actions\Tenancies\ExpireTenancyReservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class TenancyReservationExpiryTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_scheduled_expiry_marks_original_proposal_terminal_once(): void
    {
        $listing = PublicListingFixture::published();
        $startDate = CarbonImmutable::today()->addDays(20)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(3)->subDay()->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $endDate);

        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->firstOrFail();
        $contract = DB::table('tenancy_contracts')->where('id', $tenancy->pending_contract_id)->firstOrFail();
        $deadline = CarbonImmutable::now()->subSecond();
        DB::table('tenancies')->where('id', $tenancy->id)->update([
            'confirmation_expires_at' => $deadline,
        ]);

        $this->assertFalse(app(ExpireTenancyReservation::class)->handle(
            $tenancy->id,
            (string) Str::uuid(),
            $deadline->toDateTimeString(),
        ));

        Artisan::call('tenancies:expire-confirmations');
        Artisan::call('tenancies:expire-confirmations');

        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'status' => 'EXPIRED',
            'blocked_start_date' => null,
            'blocked_end_date' => null,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $contract->id,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
        ]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => null,
            'entity_type' => 'tenancy',
            'entity_id' => $tenancy->id,
            'action' => 'tenancy.contract.expired',
            'correlation_id' => $contract->id,
        ]);
        $this->assertDatabaseCount('notifications', 2);
    }

    public function test_tenant_confirmation_attempt_reaps_its_own_expired_reservation(): void
    {
        $listing = PublicListingFixture::published();
        $startDate = CarbonImmutable::today()->addDays(20)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(3)->subDay()->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $endDate);

        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->firstOrFail();
        $tenant = User::query()->findOrFail($tenancy->tenant_id);
        DB::table('tenancies')->where('id', $tenancy->id)->update([
            'confirmation_expires_at' => now()->subSecond(),
        ]);

        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/contracts/'.$tenancy->pending_contract_id.'/confirm',
            ['client_operation_id' => (string) Str::uuid()],
        )->assertConflict();

        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'status' => 'EXPIRED',
            'pending_contract_id' => null,
            'blocked_start_date' => null,
            'blocked_end_date' => null,
        ]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notifications', 2);
    }

    public function test_expired_renewal_releases_only_the_extension_and_keeps_request_pending(): void
    {
        $case = $this->pendingRenewalWithProposal();
        $deadline = CarbonImmutable::now()->subSecond();
        DB::table('tenancies')->where('id', $case['tenancy']->id)->update([
            'confirmation_expires_at' => $deadline,
        ]);

        Artisan::call('tenancies:expire-confirmations');

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'confirmed_start_date' => $case['start_date'],
            'confirmed_end_date' => $case['confirmed_end_date'],
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $case['confirmed_end_date'],
            'latest_confirmed_contract_id' => $case['basis_contract']->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal_request']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['renewal_contract']->id,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => null,
            'entity_type' => 'tenancy_renewal_request',
            'entity_id' => $case['renewal_request']->id,
            'action' => 'tenancy.renewal.proposal.expired',
            'correlation_id' => $case['renewal_contract']->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['tenant']->id,
            'event_key' => 'tenancy.renewal.proposal.expired:'.$case['renewal_contract']->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['listing']->owner->id,
            'event_key' => 'tenancy.renewal.proposal.expired:'.$case['renewal_contract']->id,
        ]);
    }

    public function test_new_proposal_reaps_an_expired_overlapping_hold_before_retrying(): void
    {
        $listing = PublicListingFixture::published();
        $unitId = $listing->unitIds[0];
        $startDate = CarbonImmutable::today()->addDays(20)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(3)->subDay()->toDateString();
        PublicListingFixture::blockUnit($unitId, $startDate, $endDate);

        $expiredTenancy = DB::table('tenancies')->where('unit_id', $unitId)->firstOrFail();
        DB::table('tenancies')->where('id', $expiredTenancy->id)->update([
            'confirmation_expires_at' => now()->subSecond(),
        ]);

        $tenant = User::factory()->create();
        $requestId = $this->createPendingRentalRequest($listing, $tenant, $unitId, $startDate, $endDate);

        $this->actingAs($listing->owner, 'web')->postJson(
            '/api/v1/owner/rental-requests/'.$requestId.'/proposal',
            [
                'client_operation_id' => (string) Str::uuid(),
                'unit_id' => $unitId,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'monthly_rent' => 3_800_000,
                'deposit_amount' => 3_800_000,
                'policies_snapshot' => [
                    'schema_version' => 1,
                    'pets' => 'NOT_ALLOWED',
                    'smoking' => 'NOT_ALLOWED',
                    'shared_rules' => [],
                ],
            ],
        )->assertCreated();

        $this->assertDatabaseHas('tenancies', [
            'id' => $expiredTenancy->id,
            'status' => 'EXPIRED',
            'pending_contract_id' => null,
        ]);
        $this->assertDatabaseHas('tenancies', [
            'rental_request_id' => $requestId,
            'status' => 'PENDING_CONFIRMATION',
            'blocked_start_date' => $startDate,
            'blocked_end_date' => $endDate,
        ]);
    }

    /** @return array<string, mixed> */
    private function pendingRenewalWithProposal(): array
    {
        $listing = PublicListingFixture::published();
        $startDate = CarbonImmutable::today()->addDays(30)->toDateString();
        $confirmedEndDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(4)->subDay()->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $confirmedEndDate);

        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->firstOrFail();
        $tenant = User::query()->findOrFail($tenancy->tenant_id);
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/contracts/'.$tenancy->pending_contract_id.'/confirm',
            ['client_operation_id' => (string) Str::uuid()],
        )->assertOk();

        $tenancy = DB::table('tenancies')->where('id', $tenancy->id)->firstOrFail();
        $basisContract = DB::table('tenancy_contracts')
            ->where('id', $tenancy->latest_confirmed_contract_id)
            ->firstOrFail();
        $requestedEndDate = CarbonImmutable::parse($confirmedEndDate)->addMonthsNoOverflow(2)->toDateString();
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/renewal-requests',
            [
                'client_operation_id' => (string) Str::uuid(),
                'requested_end_date' => $requestedEndDate,
                'proposed_monthly_rent' => 4_250_000,
                'message' => 'Tôi muốn gia hạn kỳ thuê.',
            ],
        )->assertCreated();

        $renewalRequest = DB::table('tenancy_renewal_requests')
            ->where('tenancy_id', $tenancy->id)
            ->firstOrFail();
        Auth::forgetGuards();
        $response = $this->actingAs($listing->owner, 'web')->postJson(
            '/api/v1/owner/tenancies/'.$tenancy->id.'/renewal-requests/'.$renewalRequest->id.'/proposal',
            [
                'client_operation_id' => (string) Str::uuid(),
                'end_date' => $requestedEndDate,
                'monthly_rent' => 4_250_000,
                'deposit_amount' => $basisContract->deposit_amount,
                'policies_snapshot' => json_decode($basisContract->policies_snapshot, true, flags: JSON_THROW_ON_ERROR),
            ],
        );
        $response->assertCreated();

        $renewalContract = DB::table('tenancy_contracts')
            ->where('id', $response->json('data.contract.id'))
            ->firstOrFail();

        return [
            'listing' => $listing,
            'tenant' => $tenant,
            'tenancy' => $tenancy,
            'basis_contract' => $basisContract,
            'renewal_request' => $renewalRequest,
            'renewal_contract' => $renewalContract,
            'start_date' => $startDate,
            'confirmed_end_date' => $confirmedEndDate,
        ];
    }

    private function createPendingRentalRequest(
        PublishedListing $listing,
        User $tenant,
        string $unitId,
        string $startDate,
        string $endDate,
    ): string {
        $id = (string) Str::uuid();
        DB::table('rental_requests')->insert([
            'id' => $id,
            'listing_id' => $listing->listingId,
            'tenant_id' => $tenant->id,
            'preferred_unit_id' => $unitId,
            'client_operation_id' => (string) Str::uuid(),
            'desired_move_in_date' => $startDate,
            'desired_end_date' => $endDate,
            'message' => 'Yêu cầu thuê để kiểm tra thời hạn giữ chỗ.',
            'contact_name' => $tenant->name,
            'contact_phone' => '0901234567',
            'status' => 'PENDING',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }
}
