<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class TenantTenancyRenewalRequestsTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_tenant_can_submit_one_renewal_request_and_replay_without_changing_current_term(): void
    {
        $case = $this->confirmedTenancy();
        $operationId = (string) Str::uuid();
        $payload = [
            'client_operation_id' => $operationId,
            'requested_end_date' => CarbonImmutable::parse($case['end_date'])->addMonthsNoOverflow(2)->toDateString(),
            'proposed_monthly_rent' => 4_250_000,
            'message' => 'Tôi muốn gia hạn thêm hai tháng.',
        ];
        $url = '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/renewal-requests';

        $this->actingAs($case['tenant'], 'web')->postJson($url, $payload)
            ->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.tenancy_id', $case['tenancy']->id)
            ->assertJsonPath('data.requested_end_date', $payload['requested_end_date'])
            ->assertJsonPath('data.proposed_monthly_rent', '4250000')
            ->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.replayed', false);

        $renewal = DB::table('tenancy_renewal_requests')->firstOrFail();
        $this->assertDatabaseHas('tenancies', [
            'id' => $case['tenancy']->id,
            'status' => 'CONFIRMED',
            'confirmed_start_date' => $case['start_date'],
            'confirmed_end_date' => $case['end_date'],
            'blocked_start_date' => $case['start_date'],
            'blocked_end_date' => $case['end_date'],
            'pending_contract_id' => null,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $case['tenant']->id,
            'entity_type' => 'tenancy_renewal_request',
            'entity_id' => $renewal->id,
            'action' => 'tenancy.renewal.requested',
            'correlation_id' => $operationId,
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $case['listing']->owner->id,
            'audience' => 'OWNER',
            'event_key' => 'tenancy.renewal.requested:'.$renewal->id,
        ]);

        $this->actingAs($case['tenant'], 'web')->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.id', $renewal->id)
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('tenancy_renewal_requests', 1);
        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseCount('idempotency_records', 2);
    }

    public function test_same_operation_id_with_changed_terms_conflicts_and_another_pending_request_is_rejected(): void
    {
        $case = $this->confirmedTenancy();
        $operationId = (string) Str::uuid();
        $payload = $this->validPayload($case, $operationId);
        $url = '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/renewal-requests';

        $this->actingAs($case['tenant'], 'web')->postJson($url, $payload)->assertCreated();
        $this->actingAs($case['tenant'], 'web')->postJson($url, array_replace($payload, [
            'proposed_monthly_rent' => 4_500_000,
        ]))->assertConflict();
        $this->actingAs($case['tenant'], 'web')->postJson($url, $this->validPayload($case))->assertConflict();

        $this->assertDatabaseCount('tenancy_renewal_requests', 1);
        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseCount('notifications', 2);
    }

    public function test_wrong_tenant_pending_tenancy_and_invalid_end_date_are_rejected(): void
    {
        $case = $this->confirmedTenancy();
        $url = '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/renewal-requests';
        $payload = $this->validPayload($case);

        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->postJson($url, $payload)->assertNotFound();
        Auth::forgetGuards();
        $this->actingAs($case['tenant'], 'web')->postJson($url, array_replace($payload, [
            'requested_end_date' => $case['end_date'],
        ]))->assertUnprocessable()->assertJsonValidationErrors('requested_end_date');

        $pendingCase = $this->pendingTenancy();
        $pendingUrl = '/api/v1/tenant/tenancies/'.$pendingCase['tenancy']->id.'/renewal-requests';
        Auth::forgetGuards();
        $this->actingAs($pendingCase['tenant'], 'web')->postJson(
            $pendingUrl,
            $this->validPayload($pendingCase),
        )->assertConflict();

        $this->assertDatabaseCount('tenancy_renewal_requests', 0);
    }

    public function test_guests_and_personal_access_tokens_cannot_submit_renewal_requests(): void
    {
        $case = $this->confirmedTenancy();
        $url = '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/renewal-requests';
        $payload = $this->validPayload($case);

        Auth::guard('web')->logout();
        Auth::forgetGuards();
        $this->postJson($url, $payload)->assertUnauthorized();
        $token = $case['tenant']->createToken('renewal test', ['account:read'], now()->addHour())->plainTextToken;
        $this->withToken($token)->postJson($url, $payload)->assertForbidden();

        $this->assertDatabaseCount('tenancy_renewal_requests', 0);
    }

    public function test_request_terms_are_immutable_in_the_database(): void
    {
        $case = $this->confirmedTenancy();
        $this->actingAs($case['tenant'], 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$case['tenancy']->id.'/renewal-requests',
            $this->validPayload($case),
        )->assertCreated();

        $this->expectException(QueryException::class);
        DB::table('tenancy_renewal_requests')->update(['proposed_monthly_rent' => 9_000_000]);
    }

    /** @return array{listing: object, tenant: User, tenancy: object, start_date: string, end_date: string} */
    private function confirmedTenancy(): array
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

        return [
            'listing' => $listing,
            'tenant' => $tenant,
            'tenancy' => $tenancy,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ];
    }

    /** @return array{listing: object, tenant: User, tenancy: object, start_date: string, end_date: string} */
    private function pendingTenancy(): array
    {
        $listing = PublicListingFixture::published();
        $startDate = now()->addDays(30)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(4)->subDay()->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $endDate);
        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->firstOrFail();

        return [
            'listing' => $listing,
            'tenancy' => $tenancy,
            'tenant' => User::query()->findOrFail($tenancy->tenant_id),
            'start_date' => $startDate,
            'end_date' => $endDate,
        ];
    }

    /**
     * @param  array{end_date: string}  $case
     * @return array{client_operation_id: string, requested_end_date: string, proposed_monthly_rent: int, message: string}
     */
    private function validPayload(array $case, ?string $operationId = null): array
    {
        return [
            'client_operation_id' => $operationId ?? (string) Str::uuid(),
            'requested_end_date' => CarbonImmutable::parse($case['end_date'])->addMonthsNoOverflow(2)->toDateString(),
            'proposed_monthly_rent' => 4_250_000,
            'message' => 'Tôi muốn gia hạn kỳ thuê.',
        ];
    }
}
