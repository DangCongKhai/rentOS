<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class TenantTenancyDeclinesTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_can_decline_and_retry_the_exact_pending_contract(): void
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
        $operationId = (string) Str::uuid();
        $payload = [
            'client_operation_id' => $operationId,
            'reason' => 'The proposed dates do not work for me.',
        ];
        $url = "/api/v1/tenant/tenancies/{$tenancy->id}/contracts/{$contract->id}/decline";

        $this->actingAs($tenant)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.tenancy_id', $tenancy->id)
            ->assertJsonPath('data.status', 'AWAITING_REVISION')
            ->assertJsonPath('data.contract_id', $contract->id)
            ->assertJsonPath('data.reason', $payload['reason'])
            ->assertJsonPath('data.replayed', false);

        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'status' => 'AWAITING_REVISION',
            'blocked_start_date' => null,
            'blocked_end_date' => null,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
            'confirmed_start_date' => null,
            'confirmed_end_date' => null,
            'latest_confirmed_contract_id' => null,
        ]);

        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $contract->id,
            'tenant_rejection_reason' => $payload['reason'],
        ]);
        $this->assertNotNull(DB::table('tenancy_contracts')
            ->where('id', $contract->id)
            ->value('tenant_rejected_at'));

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'tenancy',
            'entity_id' => $tenancy->id,
            'action' => 'tenancy.contract.declined',
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $tenancy->owner_id,
            'audience' => 'OWNER',
            'event_key' => 'tenancy.contract.declined:'.$contract->id,
        ]);

        $this->actingAs($tenant)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'AWAITING_REVISION')
            ->assertJsonPath('data.replayed', true);

        $changedPayload = $payload;
        $changedPayload['reason'] = 'I changed my mind about the reason.';
        $this->actingAs($tenant)->postJson($url, $changedPayload)
            ->assertConflict();

        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    public function test_tenant_cannot_decline_a_contract_that_is_not_pending(): void
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
            "/api/v1/tenant/tenancies/{$tenancy->id}/contracts/".Str::uuid().'/decline',
            [
                'client_operation_id' => (string) Str::uuid(),
                'reason' => 'This version is not current.',
            ],
        )->assertConflict();

        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'status' => 'PENDING_CONFIRMATION',
            'pending_contract_id' => $contract->id,
        ]);
        $this->assertNull(DB::table('tenancy_contracts')
            ->where('id', $contract->id)
            ->value('tenant_rejected_at'));
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertDatabaseCount('idempotency_records', 0);
    }
}
