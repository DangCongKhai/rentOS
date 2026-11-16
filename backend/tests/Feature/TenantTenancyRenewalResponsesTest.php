<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class TenantTenancyRenewalResponsesTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_tenant_confirmation_accepts_the_renewal_and_expands_confirmed_dates_atomically(): void
    {
        $case = $this->proposedRenewal();
        $operationId = (string) Str::uuid();
        $url = $this->contractUrl($case);
        $payload = ['client_operation_id' => $operationId];

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url.'/confirm', $payload)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.tenancy_id', $case['tenancy']->id)
            ->assertJsonPath('data.status', 'CONFIRMED')
            ->assertJsonPath('data.confirmed_start_date', $case['start_date'])
            ->assertJsonPath('data.confirmed_end_date', $case['proposal_end_date'])
            ->assertJsonPath('data.contract_id', $case['contract']->id)
            ->assertJsonPath('data.replayed', false);

        $this->assertNotNull(DB::table('tenancy_contracts')
            ->where('id', $case['contract']->id)
            ->value('tenant_confirmed_at'));
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['contract']->id,
            'tenant_rejected_at' => null,
        ]);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'ACCEPTED',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'confirmed_start_date' => $case['start_date'],
            'confirmed_end_date' => $case['proposal_end_date'],
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $case['proposal_end_date'],
            'latest_confirmed_contract_id' => $case['contract']->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['listing']->owner->id,
            'event_key' => 'tenancy.renewal.accepted:'.$case['contract']->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $case['tenant']->id,
            'entity_type' => 'tenancy_renewal_request',
            'entity_id' => $case['renewal']->id,
            'action' => 'tenancy.renewal.accepted',
            'correlation_id' => $operationId,
        ]);

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url.'/confirm', $payload)
            ->assertOk()
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancy_contracts', 2);
        $this->assertSame(1, DB::table('notifications')
            ->where('event_key', 'tenancy.renewal.accepted:'.$case['contract']->id)
            ->count());

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson(
            str_replace($case['contract']->id, (string) Str::uuid(), $url).'/confirm',
            [
                'client_operation_id' => $operationId,
            ],
        )->assertConflict();
    }

    public function test_tenant_decline_releases_only_the_renewal_extension_and_keeps_request_pending(): void
    {
        $case = $this->proposedRenewal();
        $operationId = (string) Str::uuid();
        $url = $this->contractUrl($case);
        $payload = [
            'client_operation_id' => $operationId,
            'reason' => 'Tôi cần trao đổi lại về giá thuê.',
        ];

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url.'/decline', $payload)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.tenancy_id', $case['tenancy']->id)
            ->assertJsonPath('data.status', 'CONFIRMED')
            ->assertJsonPath('data.contract_id', $case['contract']->id)
            ->assertJsonPath('data.reason', $payload['reason'])
            ->assertJsonPath('data.replayed', false);

        $this->assertNotNull(DB::table('tenancy_contracts')
            ->where('id', $case['contract']->id)
            ->value('tenant_rejected_at'));
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['contract']->id,
            'tenant_confirmed_at' => null,
            'tenant_rejection_reason' => $payload['reason'],
        ]);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'confirmed_start_date' => $case['start_date'],
            'confirmed_end_date' => $case['end_date'],
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $case['end_date'],
            'latest_confirmed_contract_id' => $case['basis']->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['listing']->owner->id,
            'event_key' => 'tenancy.renewal.proposal.declined:'.$case['contract']->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $case['tenant']->id,
            'entity_type' => 'tenancy_renewal_request',
            'entity_id' => $case['renewal']->id,
            'action' => 'tenancy.renewal.proposal.declined',
            'correlation_id' => $operationId,
            'reason' => $payload['reason'],
        ]);

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url.'/decline', $payload)
            ->assertOk()
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancy_contracts', 2);
        $this->assertSame(1, DB::table('notifications')
            ->where('event_key', 'tenancy.renewal.proposal.declined:'.$case['contract']->id)
            ->count());

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url.'/confirm', [
            'client_operation_id' => (string) Str::uuid(),
        ])->assertConflict();
    }

    public function test_expired_renewal_version_cannot_be_confirmed_or_declined(): void
    {
        $case = $this->proposedRenewal();
        DB::table('tenancies')
            ->where('id', $case['tenancy']->id)
            ->update(['confirmation_expires_at' => now()->subSecond()]);
        $url = $this->contractUrl($case);

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url.'/confirm', [
            'client_operation_id' => (string) Str::uuid(),
        ])->assertConflict();

        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url.'/decline', [
            'client_operation_id' => (string) Str::uuid(),
            'reason' => 'Đề xuất đã hết hạn.',
        ])->assertConflict();

        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['end_date'],
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $case['end_date'],
            'latest_confirmed_contract_id' => $case['basis']->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => null,
            'entity_type' => 'tenancy_renewal_request',
            'entity_id' => $case['renewal']->id,
            'action' => 'tenancy.renewal.proposal.expired',
            'correlation_id' => $case['contract']->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['tenant']->id,
            'event_key' => 'tenancy.renewal.proposal.expired:'.$case['contract']->id,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $case['contract']->id,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
        ]);
    }

    public function test_another_tenant_cannot_confirm_or_decline_the_renewal_version(): void
    {
        $case = $this->proposedRenewal();
        $url = $this->contractUrl($case);
        $otherTenant = User::factory()->create();

        Auth::forgetGuards();
        $this->actingAs($otherTenant, 'web')->postJson($url.'/confirm', [
            'client_operation_id' => (string) Str::uuid(),
        ])->assertNotFound();

        Auth::forgetGuards();
        $this->actingAs($otherTenant, 'web')->postJson($url.'/decline', [
            'client_operation_id' => (string) Str::uuid(),
            'reason' => 'Không phải kỳ thuê của tôi.',
        ])->assertNotFound();

        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $case['renewal']->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'confirmed_end_date' => $case['end_date'],
            'blocked_end_date' => $case['proposal_end_date'],
            'pending_contract_id' => $case['contract']->id,
        ]);
    }

    /**
     * @return array{
     *     listing: PublishedListing,
     *     tenant: User,
     *     tenancy: object,
     *     basis: object,
     *     renewal: object,
     *     contract: object,
     *     start_date: string,
     *     end_date: string,
     *     proposal_end_date: string
     * }
     */
    private function proposedRenewal(): array
    {
        $listing = PublicListingFixture::published();
        $startDate = now()->addDays(30)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)
            ->addMonthsNoOverflow(3)
            ->subDay()
            ->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $endDate);

        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->firstOrFail();
        $tenant = User::query()->findOrFail($tenancy->tenant_id);
        Auth::forgetGuards();
        $this->actingAs($tenant, 'web')->postJson(
            "/api/v1/tenant/tenancies/{$tenancy->id}/contracts/{$tenancy->pending_contract_id}/confirm",
            ['client_operation_id' => (string) Str::uuid()],
        )->assertOk();

        $tenancy = DB::table('tenancies')->where('id', $tenancy->id)->firstOrFail();
        $basis = DB::table('tenancy_contracts')->where('id', $tenancy->latest_confirmed_contract_id)->firstOrFail();
        Auth::forgetGuards();
        $this->actingAs($tenant, 'web')->postJson(
            "/api/v1/tenant/tenancies/{$tenancy->id}/renewal-requests",
            [
                'client_operation_id' => (string) Str::uuid(),
                'requested_end_date' => CarbonImmutable::parse($endDate)->addMonthsNoOverflow(2)->toDateString(),
                'proposed_monthly_rent' => 3_800_000,
                'message' => 'Tôi muốn gia hạn kỳ thuê.',
            ],
        )->assertCreated();

        $renewal = DB::table('tenancy_renewal_requests')->where('tenancy_id', $tenancy->id)->firstOrFail();
        $proposalEndDate = CarbonImmutable::parse($endDate)->addMonthsNoOverflow(4)->toDateString();
        Auth::forgetGuards();
        $proposal = $this->actingAs($listing->owner, 'web')->postJson(
            "/api/v1/owner/tenancies/{$tenancy->id}/renewal-requests/{$renewal->id}/proposal",
            [
                'client_operation_id' => (string) Str::uuid(),
                'end_date' => $proposalEndDate,
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

        return [
            'listing' => $listing,
            'tenant' => $tenant,
            'tenancy' => DB::table('tenancies')->where('id', $tenancy->id)->firstOrFail(),
            'basis' => $basis,
            'renewal' => $renewal,
            'contract' => DB::table('tenancy_contracts')->where('id', $proposal->json('data.contract.id'))->firstOrFail(),
            'start_date' => $startDate,
            'end_date' => $endDate,
            'proposal_end_date' => $proposalEndDate,
        ];
    }

    /** @param array<string, mixed> $case */
    private function contractUrl(array $case): string
    {
        return "/api/v1/tenant/tenancies/{$case['tenancy']->id}/contracts/{$case['contract']->id}";
    }
}
