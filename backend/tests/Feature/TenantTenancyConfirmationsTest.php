<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class TenantTenancyConfirmationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_can_confirm_and_retry_the_exact_pending_contract(): void
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
        ];
        $url = "/api/v1/tenant/tenancies/{$tenancy->id}/contracts/{$contract->id}/confirm";

        $this->actingAs($tenant)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.tenancy_id', $tenancy->id)
            ->assertJsonPath('data.status', 'CONFIRMED')
            ->assertJsonPath('data.contract_id', $contract->id)
            ->assertJsonPath('data.replayed', false);

        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'status' => 'CONFIRMED',
            'confirmed_start_date' => $startDate,
            'confirmed_end_date' => $endDate,
            'blocked_start_date' => $startDate,
            'blocked_end_date' => $endDate,
            'latest_confirmed_contract_id' => $contract->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);

        $this->assertNotNull(DB::table('tenancy_contracts')
            ->where('id', $contract->id)
            ->value('tenant_confirmed_at'));

        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $tenancy->owner_id,
            'audience' => 'OWNER',
            'event_key' => 'tenancy.contract.confirmed:'.$contract->id,
        ]);

        $this->actingAs($tenant)->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.tenancy_id', $tenancy->id)
            ->assertJsonPath('data.replayed', true);

        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    public function test_contract_confirmation_rejects_personal_tokens_and_nonparticipants(): void
    {
        $listing = PublicListingFixture::published();
        $startDate = now()->addDays(30)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(3)->subDay()->toDateString();
        PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $endDate);

        $tenancy = DB::table('tenancies')->where('unit_id', $listing->unitIds[0])->where('status', 'PENDING_CONFIRMATION')->firstOrFail();
        $tenant = User::query()->findOrFail($tenancy->tenant_id);
        $contract = DB::table('tenancy_contracts')->where('id', $tenancy->pending_contract_id)->firstOrFail();
        $path = "/api/v1/tenant/tenancies/{$tenancy->id}/contracts/{$contract->id}/confirm";
        $payload = ['client_operation_id' => (string) Str::uuid()];

        $token = $tenant->createToken('Postman', ['account:read'], now()->addDay())->plainTextToken;
        $this->withToken($token)->postJson($path, $payload)->assertForbidden();

        $unrelatedUser = User::factory()->create();
        $this->actingAs($unrelatedUser, 'web')->postJson($path, $payload)->assertForbidden();
        $this->assertDatabaseHas('tenancies', ['id' => $tenancy->id, 'status' => 'PENDING_CONFIRMATION']);
        $this->assertNull(DB::table('tenancy_contracts')->where('id', $contract->id)->value('tenant_confirmed_at'));
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertDatabaseCount('idempotency_records', 0);
    }
}
