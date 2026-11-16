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

class TenancyRenewalResolutionTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_tenant_can_withdraw_pending_request_without_changing_current_agreement(): void
    {
        $case = $this->pendingRenewal();
        $operationId = (string) Str::uuid();
        $url = $this->tenantUrl($case);

        $this->actingAs($case['tenant'], 'web')->postJson($url.'/withdraw', [
            'client_operation_id' => $operationId,
        ])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.id', $case['renewal']->id)
            ->assertJsonPath('data.status', 'CANCELLED')
            ->assertJsonPath('data.blocked_end_date', $case['end_date'])
            ->assertJsonPath('data.replayed', false);

        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'CANCELLED',
            'reviewed_by' => $case['tenant']->id,
            'review_reason' => null,
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'confirmed_start_date' => $case['start_date'],
            'confirmed_end_date' => $case['end_date'],
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $case['end_date'],
            'latest_confirmed_contract_id' => $case['contract']->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['contract']->id,
            'tenant_confirmed_at' => $case['contract']->tenant_confirmed_at,
            'tenant_rejected_at' => null,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $case['tenant']->id,
            'entity_id' => $case['renewal']->id,
            'action' => 'tenancy.renewal.withdrawn',
            'correlation_id' => $operationId,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['listing']->owner->id,
            'audience' => 'OWNER',
            'event_key' => 'tenancy.renewal.withdrawn:'.$case['renewal']->id,
        ]);

        $this->actingAs($case['tenant'], 'web')->postJson($url.'/withdraw', [
            'client_operation_id' => $operationId,
        ])->assertOk()
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancy_renewal_requests', 1);
        $this->assertDatabaseCount('audit_logs', 3); // Original confirmation, request, withdrawal.
        $this->assertDatabaseCount('notifications', 3);
        $this->assertDatabaseCount('idempotency_records', 3);
    }

    public function test_owner_can_reject_request_with_reason_and_replay_the_decision(): void
    {
        $case = $this->pendingRenewal();
        $operationId = (string) Str::uuid();
        $url = $this->ownerUrl($case);
        $payload = [
            'client_operation_id' => $operationId,
            'reason' => 'Thời gian gia hạn này chưa phù hợp.',
        ];

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($url.'/reject', $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'REJECTED')
            ->assertJsonPath('data.review_reason', $payload['reason'])
            ->assertJsonPath('data.blocked_end_date', $case['end_date'])
            ->assertJsonPath('data.replayed', false);

        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'REJECTED',
            'reviewed_by' => $case['listing']->owner->id,
            'review_reason' => $payload['reason'],
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'confirmed_end_date' => $case['end_date'],
            'blocked_end_date' => $case['end_date'],
            'latest_confirmed_contract_id' => $case['contract']->id,
            'pending_contract_id' => null,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['contract']->id,
            'tenant_confirmed_at' => $case['contract']->tenant_confirmed_at,
            'tenant_rejected_at' => null,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['tenant']->id,
            'audience' => 'TENANT',
            'event_key' => 'tenancy.renewal.rejected:'.$case['renewal']->id,
        ]);

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($url.'/reject', $payload)
            ->assertOk()
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancy_renewal_requests', 1);
        $this->assertDatabaseCount('audit_logs', 3);
        $this->assertDatabaseCount('notifications', 3);
        $this->assertDatabaseCount('idempotency_records', 3);
    }

    public function test_resolving_request_releases_only_its_pending_extension_and_makes_its_contract_stale(): void
    {
        $case = $this->pendingRenewal(withReservation: true);
        $this->actingAs($case['tenant'], 'web')->postJson($this->tenantUrl($case).'/withdraw', [
            'client_operation_id' => (string) Str::uuid(),
        ])->assertOk();

        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['end_date'],
            'blocked_end_date' => $case['end_date'],
            'latest_confirmed_contract_id' => $case['contract']->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['pending_contract']->id,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
        ]);

        $this->actingAs($case['tenant'], 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/contracts/'.$case['pending_contract']->id.'/confirm',
            ['client_operation_id' => (string) Str::uuid()],
        )->assertConflict();
    }

    public function test_wrong_participants_invalid_reason_and_terminal_retries_are_rejected(): void
    {
        $case = $this->pendingRenewal();
        $tenantUrl = $this->tenantUrl($case);
        $ownerUrl = $this->ownerUrl($case);

        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->postJson($tenantUrl.'/withdraw', [
            'client_operation_id' => (string) Str::uuid(),
        ])->assertNotFound();

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($tenantUrl.'/withdraw', [
            'client_operation_id' => (string) Str::uuid(),
        ])->assertNotFound();

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($ownerUrl.'/reject', [
            'client_operation_id' => (string) Str::uuid(),
            'reason' => 'Không phù hợp.',
        ])->assertNotFound();

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($ownerUrl.'/reject', [
            'client_operation_id' => (string) Str::uuid(),
            'reason' => '  ',
        ])->assertUnprocessable()->assertJsonValidationErrors('reason');

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($tenantUrl.'/withdraw', [
            'client_operation_id' => (string) Str::uuid(),
        ])->assertOk();

        Auth::forgetGuards();
        $this->actingAs($case['listing']->owner, 'web')->postJson($ownerUrl.'/reject', [
            'client_operation_id' => (string) Str::uuid(),
            'reason' => 'Từ chối sau khi người thuê đã rút.',
        ])->assertConflict();
    }

    /** @return array<string, mixed> */
    private function pendingRenewal(bool $withReservation = false): array
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
        $contract = DB::table('tenancy_contracts')->where('id', $tenancy->latest_confirmed_contract_id)->firstOrFail();
        $requestedEndDate = CarbonImmutable::parse($endDate)->addMonthsNoOverflow(2)->toDateString();
        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/renewal-requests',
            [
                'client_operation_id' => (string) Str::uuid(),
                'requested_end_date' => $requestedEndDate,
                'proposed_monthly_rent' => 4_250_000,
                'message' => 'Tôi muốn gia hạn kỳ thuê.',
            ],
        )->assertCreated();

        $renewal = DB::table('tenancy_renewal_requests')->where('tenancy_id', $tenancy->id)->firstOrFail();
        $pendingContract = null;
        if ($withReservation) {
            $pendingContractId = (string) Str::uuid();
            DB::transaction(function () use ($listing, $tenancy, $contract, $renewal, $pendingContractId): void {
                DB::table('tenancy_contracts')->insert([
                    'id' => $pendingContractId,
                    'tenancy_id' => $tenancy->id,
                    'version_number' => 2,
                    'type' => 'RENEWAL',
                    'renewal_request_id' => $renewal->id,
                    'basis_contract_id' => $contract->id,
                    'start_date' => CarbonImmutable::parse($contract->end_date)->addDay()->toDateString(),
                    'end_date' => $renewal->requested_end_date,
                    'monthly_rent' => 4_250_000,
                    'deposit_amount' => $contract->deposit_amount,
                    'policies_snapshot' => $contract->policies_snapshot,
                    'document_path' => 'contracts/renewals/'.$pendingContractId.'.pdf',
                    'document_sha256' => hash('sha256', $pendingContractId),
                    'created_by' => $listing->owner->id,
                    'owner_confirmed_at' => now(),
                    'created_at' => now(),
                ]);

                DB::table('tenancies')->where('id', $tenancy->id)->update([
                    'blocked_end_date' => $renewal->requested_end_date,
                    'pending_contract_id' => $pendingContractId,
                    'confirmation_expires_at' => now()->addHours(48),
                    'updated_at' => now(),
                ]);
            });
            $pendingContract = DB::table('tenancy_contracts')->where('id', $pendingContractId)->firstOrFail();
        }

        return [
            'listing' => $listing,
            'tenant' => $tenant,
            'tenancy' => $tenancy,
            'contract' => $contract,
            'renewal' => $renewal,
            'pending_contract' => $pendingContract,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ];
    }

    /** @param array{tenancy: object, renewal: object} $case */
    private function tenantUrl(array $case): string
    {
        return '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/renewal-requests/'.$case['renewal']->id;
    }

    /** @param array{tenancy: object, renewal: object} $case */
    private function ownerUrl(array $case): string
    {
        return '/api/v1/owner/tenancies/'.$case['tenancy']->id.'/renewal-requests/'.$case['renewal']->id;
    }
}
