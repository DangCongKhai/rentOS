<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class TenancyRenewalResolutionConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_tenant_withdrawal_and_owner_rejection_have_one_terminal_result(): void
    {
        $listing = PublicListingFixture::published();
        $startDate = now()->addDays(30)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)->addMonthsNoOverflow(4)->subDay()->toDateString();
        DB::transaction(function () use ($listing, $startDate, $endDate): void {
            PublicListingFixture::blockUnit($listing->unitIds[0], $startDate, $endDate);
        });

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
                'proposed_monthly_rent' => 4_250_000,
                'message' => 'Tôi muốn gia hạn kỳ thuê.',
            ],
        )->assertCreated();
        $renewal = DB::table('tenancy_renewal_requests')->where('tenancy_id', $tenancy->id)->firstOrFail();
        $pendingContractId = (string) Str::uuid();

        DB::transaction(function () use ($listing, $tenancy, $basis, $renewal, $pendingContractId): void {
            DB::select('SELECT set_config(?, ?, true)', ['rentos.actor_id', $listing->owner->id]);
            DB::table('tenancy_contracts')->insert([
                'id' => $pendingContractId,
                'tenancy_id' => $tenancy->id,
                'version_number' => 2,
                'type' => 'RENEWAL',
                'renewal_request_id' => $renewal->id,
                'basis_contract_id' => $basis->id,
                'start_date' => CarbonImmutable::parse($basis->end_date)->addDay()->toDateString(),
                'end_date' => $renewal->requested_end_date,
                'monthly_rent' => 4_250_000,
                'deposit_amount' => $basis->deposit_amount,
                'policies_snapshot' => $basis->policies_snapshot,
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

        $tenantPath = '/api/v1/tenant/tenancies/'.$tenancy->id.'/renewal-requests/'.$renewal->id.'/withdraw';
        $ownerPath = '/api/v1/owner/tenancies/'.$tenancy->id.'/renewal-requests/'.$renewal->id.'/reject';
        $statuses = Concurrency::driver('process')->run([
            $this->postInProcess($tenant->id, $tenantPath, [
                'client_operation_id' => (string) Str::uuid(),
            ]),
            $this->postInProcess($listing->owner->id, $ownerPath, [
                'client_operation_id' => (string) Str::uuid(),
                'reason' => 'Không thể thống nhất thời hạn gia hạn.',
            ]),
        ], timeout: 30);

        sort($statuses);
        $this->assertSame([200, 409], $statuses);
        $terminalStatus = DB::table('tenancy_renewal_requests')->where('id', $renewal->id)->value('status');
        $this->assertContains($terminalStatus, ['CANCELLED', 'REJECTED']);
        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'status' => 'CONFIRMED',
            'confirmed_end_date' => $endDate,
            'blocked_end_date' => $endDate,
            'latest_confirmed_contract_id' => $basis->id,
            'pending_contract_id' => null,
            'confirmation_expires_at' => null,
        ]);
        $this->assertDatabaseHas('tenancy_contracts', [
            'id' => $pendingContractId,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
        ]);
        $this->assertDatabaseCount('tenancy_renewal_requests', 1);
        $this->assertDatabaseCount('audit_logs', 3);
        $this->assertDatabaseCount('notifications', 3);
        $this->assertDatabaseCount('idempotency_records', 3);
    }

    /** @param array<string, string|int> $payload */
    private function postInProcess(string $actorId, string $path, array $payload): Closure
    {
        return static function () use ($actorId, $path, $payload): int {
            abort_unless(config('database.default') === 'pgsql'
                && config('database.connections.pgsql.database') === 'rentos_test'
                && in_array(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost'], true), 500);

            Auth::guard('web')->setUser(User::query()->findOrFail($actorId));
            $request = Request::create($path, 'POST', server: [
                'HTTP_ACCEPT' => 'application/json',
                'CONTENT_TYPE' => 'application/json',
            ], content: json_encode($payload, JSON_THROW_ON_ERROR));

            return app(Kernel::class)->handle($request)->getStatusCode();
        };
    }
}
