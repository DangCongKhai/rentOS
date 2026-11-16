<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class OwnerTenancyRenewalProposalsTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_owner_can_submit_and_replay_a_renewal_version_without_changing_confirmed_terms(): void
    {
        $case = $this->pendingRenewal();
        $payload = $this->proposalPayload($case);
        $url = $this->proposalUrl($case);

        Auth::forgetGuards();
        $response = $this->actingAs($case['listing']->owner, 'web')->postJson($url, $payload);
        $response->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.tenancy_id', $case['tenancy']->id)
            ->assertJsonPath('data.status', 'CONFIRMED')
            ->assertJsonPath('data.contract.type', 'RENEWAL')
            ->assertJsonPath('data.contract.version_number', 2)
            ->assertJsonPath('data.contract.basis_contract_id', $case['basis']->id)
            ->assertJsonPath('data.contract.start_date', CarbonImmutable::parse($case['end_date'])->addDay()->toDateString())
            ->assertJsonPath('data.contract.end_date', $payload['end_date'])
            ->assertJsonPath('data.replayed', false);

        $contractId = $response->json('data.contract.id');
        $expiresAt = CarbonImmutable::parse($response->json('data.confirmation_expires_at'));
        $confirmationHours = max(1, (int) config('services.supabase.contracts.confirmation_hours', 48));
        $remainingSeconds = $expiresAt->getTimestamp() - CarbonImmutable::now()->getTimestamp();
        $this->assertLessThanOrEqual(60, abs($remainingSeconds - ($confirmationHours * 3600)));

        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'PENDING',
            'proposed_monthly_rent' => 3_800_000,
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'confirmed_start_date' => $case['start_date'],
            'confirmed_end_date' => $case['end_date'],
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $payload['end_date'],
            'latest_confirmed_contract_id' => $case['basis']->id,
            'pending_contract_id' => $contractId,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $contractId,
            'tenancy_id' => $case['tenancy']->id,
            'version_number' => 2,
            'type' => 'RENEWAL',
            'renewal_request_id' => $case['renewal']->id,
            'basis_contract_id' => $case['basis']->id,
            'start_date' => CarbonImmutable::parse($case['end_date'])->addDay()->toDateString(),
            'end_date' => $payload['end_date'],
            'monthly_rent' => 4_200_000,
            'document_path' => null,
            'tenant_confirmed_at' => null,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['tenant']->id,
            'audience' => 'TENANT',
            'event_key' => 'tenancy.renewal.proposed:'.$contractId,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $case['listing']->owner->id,
            'entity_id' => $case['tenancy']->id,
            'action' => 'tenancy.renewal.proposed',
            'correlation_id' => $payload['client_operation_id'],
        ]);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.contract.id', $contractId)
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancy_renewal_requests', 1);
        $this->assertDatabaseCount('tenancy_contracts', 2);
        $this->assertDatabaseCount('audit_logs', 3); // Original confirmation, renewal request, renewal proposal.
        $this->assertDatabaseCount('notifications', 3);
        $this->assertDatabaseCount('idempotency_records', 3);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($url, array_replace($payload, [
            'monthly_rent' => 4_300_000,
        ]))->assertConflict();
    }

    public function test_invalid_or_client_controlled_start_date_does_not_create_a_version(): void
    {
        $case = $this->pendingRenewal();
        $url = $this->proposalUrl($case);
        $payload = $this->proposalPayload($case);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($url, array_replace($payload, [
            'end_date' => $case['end_date'],
        ]))->assertUnprocessable()->assertJsonValidationErrors('end_date');

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($url, $payload + [
            'start_date' => $case['end_date'],
        ])->assertUnprocessable()->assertJsonValidationErrors('start_date');

        $this->assertDatabaseCount('tenancy_contracts', 1);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['end_date'],
            'blocked_end_date' => $case['end_date'],
            'pending_contract_id' => null,
        ]);
    }

    public function test_extension_conflict_rolls_back_and_leaves_the_renewal_request_pending(): void
    {
        $case = $this->pendingRenewal();
        $futureStart = CarbonImmutable::parse($case['end_date'])->addDay()->toDateString();
        $futureEnd = CarbonImmutable::parse($futureStart)->addMonthsNoOverflow(3)->subDay()->toDateString();
        PublicListingFixture::blockUnit($case['listing']->unitIds[0], $futureStart, $futureEnd);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson(
            $this->proposalUrl($case),
            $this->proposalPayload($case, $futureEnd),
        )->assertConflict();

        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['end_date'],
            'blocked_end_date' => $case['end_date'],
            'pending_contract_id' => null,
        ]);
        $this->assertDatabaseCount('tenancy_contracts', 2); // Basis contract plus future reservation.
    }

    public function test_only_the_tenancy_owner_can_propose_a_renewal(): void
    {
        $case = $this->pendingRenewal();

        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->postJson(
            $this->proposalUrl($case),
            $this->proposalPayload($case),
        )->assertNotFound();

        $this->assertDatabaseCount('tenancy_contracts', 1);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'PENDING',
        ]);
    }

    /** @return array<string, mixed> */
    private function pendingRenewal(): array
    {
        $listing = PublicListingFixture::published();
        $startDate = now()->addDays(30)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(4)->subDay()->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $endDate);

        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->firstOrFail();
        $tenant = User::query()->findOrFail($tenancy->tenant_id);
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/contracts/'.$tenancy->pending_contract_id.'/confirm',
            ['client_operation_id' => (string) Str::uuid()],
        )->assertOk();

        $tenancy = DB::table('tenancies')->where('id', $tenancy->id)->firstOrFail();
        $basis = DB::table('tenancy_contracts')->where('id', $tenancy->latest_confirmed_contract_id)->firstOrFail();
        $requestedEndDate = CarbonImmutable::parse($endDate)->addMonthsNoOverflow(2)->toDateString();
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/renewal-requests',
            [
                'client_operation_id' => (string) Str::uuid(),
                'requested_end_date' => $requestedEndDate,
                'proposed_monthly_rent' => 3_800_000,
                'message' => 'Tôi muốn gia hạn kỳ thuê.',
            ],
        )->assertCreated();

        return [
            'listing' => $listing,
            'tenant' => $tenant,
            'tenancy' => $tenancy,
            'basis' => $basis,
            'renewal' => DB::table('tenancy_renewal_requests')->where('tenancy_id', $tenancy->id)->firstOrFail(),
            'start_date' => $startDate,
            'end_date' => $endDate,
        ];
    }

    /** @param array<string, mixed> $case
     * @return array<string, mixed>
     */
    private function proposalPayload(array $case, ?string $endDate = null): array
    {
        return [
            'client_operation_id' => (string) Str::uuid(),
            'end_date' => $endDate ?? CarbonImmutable::parse($case['end_date'])->addMonthsNoOverflow(3)->toDateString(),
            'monthly_rent' => 4_200_000,
            'deposit_amount' => 4_200_000,
            'policies_snapshot' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => ['Giữ yên tĩnh sau 22:00'],
            ],
        ];
    }

    /** @param array<string, mixed> $case */
    private function proposalUrl(array $case): string
    {
        return '/api/v1/owner/tenancies/'.$case['tenancy']->id.'/renewal-requests/'.$case['renewal']->id.'/proposal';
    }
}
