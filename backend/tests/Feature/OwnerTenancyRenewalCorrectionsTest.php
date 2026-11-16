<?php

namespace Tests\Feature;

use App\Actions\Tenancies\ExpireTenancyReservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class OwnerTenancyRenewalCorrectionsTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_owner_can_correct_and_replay_the_latest_declined_renewal_version(): void
    {
        $case = $this->declinedRenewal();
        $payload = $this->correctionPayload($case, $case['declined_contract']->id);
        $path = $this->correctionPath($case);

        Auth::forgetGuards();
        $response = $this->actingAs($case['listing']->owner, 'web')->postJson($path, $payload);
        $response->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.tenancy_id', $case['tenancy']->id)
            ->assertJsonPath('data.status', 'CONFIRMED')
            ->assertJsonPath('data.contract.version_number', 3)
            ->assertJsonPath('data.contract.type', 'RENEWAL')
            ->assertJsonPath('data.contract.supersedes_contract_id', $case['declined_contract']->id)
            ->assertJsonPath('data.contract.basis_contract_id', $case['basis']->id)
            ->assertJsonPath('data.contract.start_date', CarbonImmutable::parse($case['confirmed_end_date'])->addDay()->toDateString())
            ->assertJsonPath('data.contract.end_date', $payload['end_date'])
            ->assertJsonPath('data.replayed', false);

        $contractId = $response->json('data.contract.id');
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $contractId,
            'tenancy_id' => $case['tenancy']->id,
            'version_number' => 3,
            'type' => 'RENEWAL',
            'renewal_request_id' => $case['renewal_request']->id,
            'supersedes_contract_id' => $case['declined_contract']->id,
            'basis_contract_id' => $case['basis']->id,
            'start_date' => CarbonImmutable::parse($case['confirmed_end_date'])->addDay()->toDateString(),
            'end_date' => $payload['end_date'],
            'monthly_rent' => 4_500_000,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
            'document_path' => null,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['declined_contract']->id,
            'tenant_rejected_at' => $case['declined_contract']->tenant_rejected_at,
            'tenant_rejection_reason' => 'Tôi muốn trao đổi lại điều khoản gia hạn.',
        ]);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal_request']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => $case['tenancy']->status,
            'confirmed_start_date' => $case['confirmed_start_date'],
            'confirmed_end_date' => $case['confirmed_end_date'],
            'blocked_start_date' => $case['confirmed_start_date'],
            'blocked_end_date' => $payload['end_date'],
            'latest_confirmed_contract_id' => $case['basis']->id,
            'pending_contract_id' => $contractId,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['tenant']->id,
            'event_key' => 'tenancy.renewal.corrected:'.$contractId,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $case['listing']->owner->id,
            'entity_type' => 'tenancy_renewal_request',
            'entity_id' => $case['renewal_request']->id,
            'action' => 'tenancy.renewal.corrected',
            'correlation_id' => $payload['client_operation_id'],
        ]);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($path, $payload)
            ->assertOk()
            ->assertJsonPath('data.contract.id', $contractId)
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancy_contracts', 3);
        $this->assertSame(1, DB::table('notifications')
            ->where('event_key', 'tenancy.renewal.corrected:'.$contractId)
            ->count());

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($path, array_replace($payload, [
            'monthly_rent' => 4_600_000,
        ]))->assertConflict();
    }

    public function test_owner_can_continue_a_renewal_correction_chain_after_each_decline(): void
    {
        $case = $this->declinedRenewal();
        $firstCorrectionPayload = $this->correctionPayload($case, $case['declined_contract']->id);

        Auth::forgetGuards();
        $firstCorrection = $this->actingAs($case['listing']->owner, 'web')->postJson(
            $this->correctionPath($case),
            $firstCorrectionPayload,
        )->assertCreated();
        $firstCorrectionId = $firstCorrection->json('data.contract.id');

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/contracts/'.$firstCorrectionId.'/decline',
            [
                'client_operation_id' => (string) Str::uuid(),
                'reason' => 'Tôi vẫn cần trao đổi thêm về giá thuê.',
            ],
        )->assertOk();

        $secondPayload = $this->correctionPayload($case, $firstCorrectionId, 4_750_000);
        Auth::forgetGuards();
        $secondCorrection = $this->actingAs($case['listing']->owner, 'web')->postJson(
            $this->correctionPath($case),
            $secondPayload,
        )->assertCreated()
            ->assertJsonPath('data.contract.version_number', 4)
            ->assertJsonPath('data.contract.supersedes_contract_id', $firstCorrectionId)
            ->assertJsonPath('data.contract.basis_contract_id', $case['basis']->id);

        $this->assertNotNull(DB::table('tenancy_contracts')
            ->where('id', $firstCorrectionId)
            ->value('tenant_rejected_at'));
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $firstCorrectionId,
            'version_number' => 3,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $secondCorrection->json('data.contract.id'),
            'version_number' => 4,
            'supersedes_contract_id' => $firstCorrectionId,
            'renewal_request_id' => $case['renewal_request']->id,
            'basis_contract_id' => $case['basis']->id,
        ]);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal_request']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['confirmed_end_date'],
            'latest_confirmed_contract_id' => $case['basis']->id,
            'pending_contract_id' => $secondCorrection->json('data.contract.id'),
        ]);
    }

    public function test_owner_can_correct_the_latest_renewal_version_after_its_confirmation_expires(): void
    {
        $case = $this->declinedRenewal();
        Auth::forgetGuards();
        $firstCorrection = $this->actingAs($case['listing']->owner, 'web')->postJson(
            $this->correctionPath($case),
            $this->correctionPayload($case, $case['declined_contract']->id),
        )->assertCreated();
        $expiredContractId = $firstCorrection->json('data.contract.id');
        $expiredDeadline = now()->subSecond();

        DB::table('tenancies')
            ->where('id', $case['tenancy']->id)
            ->update(['confirmation_expires_at' => $expiredDeadline]);

        $this->assertTrue(app(ExpireTenancyReservation::class)->handle(
            $case['tenancy']->id,
            $expiredContractId,
            $expiredDeadline->toDateTimeString(),
        ));

        $nextPayload = $this->correctionPayload($case, $expiredContractId, 4_650_000);
        Auth::forgetGuards();
        $nextCorrection = $this->actingAs($case['listing']->owner, 'web')->postJson(
            $this->correctionPath($case),
            $nextPayload,
        )->assertCreated()
            ->assertJsonPath('data.contract.version_number', 4)
            ->assertJsonPath('data.contract.supersedes_contract_id', $expiredContractId)
            ->assertJsonPath('data.contract.basis_contract_id', $case['basis']->id);

        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $expiredContractId,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
        ]);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal_request']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['confirmed_end_date'],
            'blocked_end_date' => $nextPayload['end_date'],
            'pending_contract_id' => $nextCorrection->json('data.contract.id'),
        ]);
    }

    public function test_correction_requires_the_exact_declined_latest_version_and_tenancy_owner(): void
    {
        $case = $this->declinedRenewal();
        $path = $this->correctionPath($case);
        $payload = $this->correctionPayload($case, $case['basis']->id);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($path, $payload)->assertConflict();

        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->postJson(
            $path,
            $this->correctionPayload($case, $case['declined_contract']->id),
        )->assertNotFound();

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson(
            $path,
            $this->correctionPayload($case, $case['declined_contract']->id) + ['start_date' => $case['confirmed_end_date']],
        )->assertUnprocessable()->assertJsonValidationErrors('start_date');

        $this->assertDatabaseCount('tenancy_contracts', 2);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal_request']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['confirmed_end_date'],
            'blocked_end_date' => $case['confirmed_end_date'],
            'pending_contract_id' => null,
        ]);
    }

    public function test_overlap_rolls_back_a_renewal_correction_without_changing_the_declined_version(): void
    {
        $case = $this->declinedRenewal();
        $conflictingStartDate = CarbonImmutable::parse($case['confirmed_end_date'])->addDay()->toDateString();
        $conflictingEndDate = CarbonImmutable::parse($conflictingStartDate)->addMonthsNoOverflow(4)->toDateString();
        PublicListingFixture::blockUnit($case['listing']->unitIds[0], $conflictingStartDate, $conflictingEndDate);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson(
            $this->correctionPath($case),
            $this->correctionPayload($case, $case['declined_contract']->id, 4_600_000, $conflictingEndDate),
        )->assertConflict();

        $this->assertDatabaseCount('tenancy_contracts', 3);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['declined_contract']->id,
            'tenant_rejected_at' => $case['declined_contract']->tenant_rejected_at,
            'tenant_rejection_reason' => 'Tôi muốn trao đổi lại điều khoản gia hạn.',
        ]);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal_request']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['confirmed_end_date'],
            'blocked_end_date' => $case['confirmed_end_date'],
            'pending_contract_id' => null,
        ]);
    }

    /**
     * @return array{
     *     listing: PublishedListing,
     *     tenant: User,
     *     tenancy: object,
     *     basis: object,
     *     renewal_request: object,
     *     declined_contract: object,
     *     confirmed_start_date: string,
     *     confirmed_end_date: string
     * }
     */
    private function declinedRenewal(): array
    {
        $listing = PublicListingFixture::published();
        $confirmedStartDate = now()->addDays(30)->toDateString();
        $confirmedEndDate = CarbonImmutable::parse($confirmedStartDate)
            ->addMonthsNoOverflow(4)
            ->subDay()
            ->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $confirmedStartDate, $confirmedEndDate);

        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->firstOrFail();
        $tenant = User::query()->findOrFail($tenancy->tenant_id);
        Auth::forgetGuards();
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/contracts/'.$tenancy->pending_contract_id.'/confirm',
            ['client_operation_id' => (string) Str::uuid()],
        )->assertOk();

        $tenancy = DB::table('tenancies')->where('id', $tenancy->id)->firstOrFail();
        $basis = DB::table('tenancy_contracts')->where('id', $tenancy->latest_confirmed_contract_id)->firstOrFail();
        Auth::forgetGuards();
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/renewal-requests',
            [
                'client_operation_id' => (string) Str::uuid(),
                'requested_end_date' => CarbonImmutable::parse($confirmedEndDate)->addMonthsNoOverflow(2)->toDateString(),
                'proposed_monthly_rent' => 3_800_000,
                'message' => 'Tôi muốn gia hạn kỳ thuê.',
            ],
        )->assertCreated();

        $renewalRequest = DB::table('tenancy_renewal_requests')->where('tenancy_id', $tenancy->id)->firstOrFail();
        Auth::forgetGuards();
        $proposal = $this->actingAs($listing->owner, 'web')->postJson(
            '/api/v1/owner/tenancies/'.$tenancy->id.'/renewal-requests/'.$renewalRequest->id.'/proposal',
            [
                'client_operation_id' => (string) Str::uuid(),
                'end_date' => CarbonImmutable::parse($confirmedEndDate)->addMonthsNoOverflow(4)->toDateString(),
                'monthly_rent' => 4_200_000,
                'deposit_amount' => 4_200_000,
                'policies_snapshot' => [
                    'schema_version' => 1,
                    'pets' => 'NOT_ALLOWED',
                    'smoking' => 'NOT_ALLOWED',
                    'shared_rules' => ['Giữ yên tĩnh sau 22:00'],
                ],
            ],
        )->assertCreated();
        $declinedContractId = $proposal->json('data.contract.id');

        Auth::forgetGuards();
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/contracts/'.$declinedContractId.'/decline',
            [
                'client_operation_id' => (string) Str::uuid(),
                'reason' => 'Tôi muốn trao đổi lại điều khoản gia hạn.',
            ],
        )->assertOk();

        return [
            'listing' => $listing,
            'tenant' => $tenant,
            'tenancy' => DB::table('tenancies')->where('id', $tenancy->id)->firstOrFail(),
            'basis' => $basis,
            'renewal_request' => $renewalRequest,
            'declined_contract' => DB::table('tenancy_contracts')->where('id', $declinedContractId)->firstOrFail(),
            'confirmed_start_date' => $confirmedStartDate,
            'confirmed_end_date' => $confirmedEndDate,
        ];
    }

    /** @param array<string, mixed> $case
     * @return array{client_operation_id: string, supersedes_contract_id: string, end_date: string, monthly_rent: int, deposit_amount: int, policies_snapshot: array<string, mixed>}
     */
    private function correctionPayload(
        array $case,
        string $supersedesContractId,
        int $rent = 4_500_000,
        ?string $endDate = null,
    ): array {
        return [
            'client_operation_id' => (string) Str::uuid(),
            'supersedes_contract_id' => $supersedesContractId,
            'end_date' => $endDate ?? CarbonImmutable::parse($case['confirmed_end_date'])->addMonthsNoOverflow(6)->toDateString(),
            'monthly_rent' => $rent,
            'deposit_amount' => $rent,
            'policies_snapshot' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => ['Giữ yên tĩnh sau 22:00'],
            ],
        ];
    }

    /** @param array<string, mixed> $case */
    private function correctionPath(array $case): string
    {
        return '/api/v1/owner/tenancies/'.$case['tenancy']->id.'/renewal-requests/'.$case['renewal_request']->id.'/corrections';
    }
}
