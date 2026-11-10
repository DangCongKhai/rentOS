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

class OwnerTenancyCorrectionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

    }

    public function test_owner_can_correct_and_replay_a_declined_proposal(): void
    {
        $case = $this->createDeclinedProposal();
        $operationId = (string) Str::uuid();
        $payload = $this->correctionPayload(
            $case['contract']->id,
            $operationId,
            $case['start_date'],
            $case['end_date'],
        );
        $url = "/api/v1/owner/tenancies/{$case['tenancy']->id}/correction";

        $this->actingAs($case['listing']->owner)->post($url, $payload)
            ->assertCreated()
            ->assertJsonPath('data.tenancy_id', $case['tenancy']->id)
            ->assertJsonPath('data.status', 'PENDING_CONFIRMATION')
            ->assertJsonPath('data.contract.version_number', 2)
            ->assertJsonPath(
                'data.contract.supersedes_contract_id',
                $case['contract']->id,
            )
            ->assertJsonPath('data.replayed', false);

        $newContractId = DB::table('tenancy_contracts')
            ->where('tenancy_id', $case['tenancy']->id)
            ->where('version_number', 2)
            ->value('id');

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'PENDING_CONFIRMATION',
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $case['end_date'],
            'pending_contract_id' => $newContractId,
        ]);

        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['contract']->id,
            'tenant_rejection_reason' => 'The proposed dates do not work for me.',
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $newContractId,
            'version_number' => 2,
            'supersedes_contract_id' => $case['contract']->id,
        ]);

        $retryPayload = $this->correctionPayload(
            $case['contract']->id,
            $operationId,
            $case['start_date'],
            $case['end_date'],
        );

        $this->actingAs($case['listing']->owner)->post($url, $retryPayload)
            ->assertOk()
            ->assertJsonPath('data.contract.id', $newContractId)
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseCount('notification_outbox', 2);
        $this->assertDatabaseCount('idempotency_records', 2);
        $this->assertDatabaseCount('tenancy_contracts', 2);
    }

    public function test_correction_conflicts_when_another_tenancy_has_reserved_the_dates(): void
    {
        $case = $this->createDeclinedProposal();

        PublicListingFixture::blockUnit(
            $case['tenancy']->unit_id,
            $case['start_date'],
            $case['end_date'],
        );

        $this->actingAs($case['listing']->owner)->post(
            "/api/v1/owner/tenancies/{$case['tenancy']->id}/correction",
            $this->correctionPayload(
                $case['contract']->id,
                (string) Str::uuid(),
                $case['start_date'],
                $case['end_date'],
            ),
        )->assertConflict();

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'AWAITING_REVISION',
            'pending_contract_id' => null,
            'blocked_start_date' => null,
            'blocked_end_date' => null,
        ]);

        $this->assertDatabaseCount(
            'tenancy_contracts',
            2,
        );
        $this->assertDatabaseMissing('audit_logs', [
            'entity_id' => $case['tenancy']->id,
            'action' => 'tenancy.contract.corrected',
        ]);
        $this->assertDatabaseMissing('idempotency_records', [
            'actor_id' => $case['listing']->owner->id,
            'action' => 'tenancy.correct',
        ]);
    }

    /**
     * @return array{
     *     listing: PublishedListing,
     *     tenancy: object,
     *     contract: object,
     *     tenant: User,
     *     start_date: string,
     *     end_date: string
     * }
     */
    private function createDeclinedProposal(): array
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

        $contract = DB::table('tenancy_contracts')
            ->where('tenancy_id', $tenancy->id)
            ->where('id', $tenancy->pending_contract_id)
            ->firstOrFail();

        $tenant = User::query()->findOrFail($tenancy->tenant_id);

        $this->actingAs($tenant)->postJson(
            "/api/v1/tenant/tenancies/{$tenancy->id}/contracts/{$contract->id}/decline",
            [
                'client_operation_id' => (string) Str::uuid(),
                'reason' => 'The proposed dates do not work for me.',
            ],
        )->assertOk();

        return [
            'listing' => $listing,
            'tenancy' => $tenancy,
            'contract' => $contract,
            'tenant' => $tenant,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function correctionPayload(
        string $supersedesContractId,
        string $operationId,
        string $startDate,
        string $endDate,
    ): array {
        return [
            'client_operation_id' => $operationId,
            'supersedes_contract_id' => $supersedesContractId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'monthly_rent' => 4200000,
            'deposit_amount' => 4200000,
            'policies_snapshot' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => [],
            ],
            'signed_on' => null,
        ];
    }
}
