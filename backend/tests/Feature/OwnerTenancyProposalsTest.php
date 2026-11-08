<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class OwnerTenancyProposalsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.supabase.url' => 'https://storage.example.test',
            'services.supabase.service_role_key' => 'test-service-role-key',
            'services.supabase.contracts.bucket' => 'contract-documents',
        ]);

        Http::fake(fn () => Http::response([], 200));
    }

    public function test_owner_can_create_and_replay_a_tenancy_proposal(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $rentalRequestId = $this->createPendingRentalRequest($listing, $tenant);
        $operationId = (string) Str::uuid();
        $payload = $this->proposalPayload($listing->unitIds[0], $operationId);

        $response = $this->actingAs($listing->owner)->post(
            "/api/v1/owner/rental-requests/{$rentalRequestId}/proposal",
            $payload,
        );

        $response->assertCreated()
            ->assertJsonPath('data.status', 'PENDING_CONFIRMATION')
            ->assertJsonPath('data.contract.version_number', 1)
            ->assertJsonPath('data.contract.type', 'ORIGINAL')
            ->assertJsonPath('data.replayed', false);

        $tenancyId = $response->json('data.tenancy_id');

        $this->assertDatabaseHas('rental_requests', [
            'id' => $rentalRequestId,
            'status' => 'ACCEPTED',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancyId,
            'rental_request_id' => $rentalRequestId,
            'status' => 'PENDING_CONFIRMATION',
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'tenancy_id' => $tenancyId,
            'version_number' => 1,
            'type' => 'ORIGINAL',
        ]);
        $this->assertNotNull(DB::table('tenancy_contracts')
            ->where('tenancy_id', $tenancyId)
            ->where('version_number', 1)
            ->value('owner_confirmed_at'));
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'tenancy',
            'entity_id' => $tenancyId,
            'action' => 'tenancy.proposed',
        ]);
        $this->assertDatabaseHas('notification_outbox', [
            'recipient_id' => $tenant->id,
            'event_type' => 'tenancy.proposed',
        ]);

        $retryPayload = $this->proposalPayload($listing->unitIds[0], $operationId);
        $retry = $this->actingAs($listing->owner)->post(
            "/api/v1/owner/rental-requests/{$rentalRequestId}/proposal",
            $retryPayload,
        );

        $retry->assertOk()
            ->assertJsonPath('data.tenancy_id', $tenancyId)
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancies', 1);
        $this->assertDatabaseCount('tenancy_contracts', 1);
        Http::assertSentCount(1);
    }

    private function createPendingRentalRequest(
        PublishedListing $listing,
        User $tenant,
    ): string {
        $id = (string) Str::uuid();
        $moveInDate = now()->addDays(14)->toDateString();

        DB::table('rental_requests')->insert([
            'id' => $id,
            'listing_id' => $listing->listingId,
            'tenant_id' => $tenant->id,
            'preferred_unit_id' => $listing->unitIds[0],
            'client_operation_id' => (string) Str::uuid(),
            'desired_move_in_date' => $moveInDate,
            'desired_end_date' => CarbonImmutable::parse($moveInDate)
                ->addMonthsNoOverflow(3)
                ->subDay()
                ->toDateString(),
            'message' => 'I would like to rent this unit.',
            'contact_name' => 'Test tenant',
            'contact_phone' => '0901234567',
            'status' => 'PENDING',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    /**
     * @return array<string, mixed>
     */
    private function proposalPayload(string $unitId, string $operationId): array
    {
        $startDate = now()->addDays(14)->toDateString();

        return [
            'client_operation_id' => $operationId,
            'unit_id' => $unitId,
            'start_date' => $startDate,
            'end_date' => CarbonImmutable::parse($startDate)
                ->addMonthsNoOverflow(3)
                ->subDay()
                ->toDateString(),
            'monthly_rent' => 3800000,
            'deposit_amount' => 3800000,
            'policies_snapshot' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => [],
            ],
            'agreement_document' => UploadedFile::fake()->createWithContent(
                'agreement.pdf',
                "%PDF-1.4\nrentOS test agreement\n%%EOF",
            ),
            'signed_on' => null,
        ];
    }

    public function test_overlapping_proposal_keeps_request_pending_and_rolls_back(): void
    {
        $listing = PublicListingFixture::published();
        $unitId = $listing->unitIds[0];

        $blockedStart = now()->addDays(20)->toDateString();
        $blockedEnd = CarbonImmutable::parse($blockedStart)
            ->addMonthNoOverflow(3)
            ->subDay()
            ->toDateString();

        PublicListingFixture::blockUnit($unitId, $blockedStart, $blockedEnd);

        $tenant = User::factory()->create();
        $rentalRequestId = $this->createPendingRentalRequest($listing, $tenant);
        $payload = $this->proposalPayload($unitId, (string) Str::uuid());

        $this->actingAs($listing->owner)->post("/api/v1/owner/rental-requests/{$rentalRequestId}/proposal", $payload)->assertConflict();

        $this->assertDatabaseHas('rental_requests', [
            'id' => $rentalRequestId,
            'status' => 'PENDING',
            'closed_at' => null,
        ]);
        $this->assertDatabaseMissing('tenancies', [
            'rental_request_id' => $rentalRequestId,
        ]);

        // the fixture's existing tenancy and contract remain; the failed proposal adds none.
        $this->assertDatabaseCount('tenancies', 1);
        $this->assertDatabaseCount('tenancy_contracts', 1);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
        $this->assertDatabaseCount('idempotency_records', 0);

        // the uploaded PDF is removed after the database transaction rolls back.
        Http::assertSentCount(2);
    }
}
