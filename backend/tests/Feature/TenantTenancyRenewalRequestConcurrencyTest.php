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

class TenantTenancyRenewalRequestConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_concurrent_renewal_requests_create_only_one_pending_request(): void
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

        $confirmedEndDate = $endDate;
        $endDate = CarbonImmutable::parse($endDate)->addMonthsNoOverflow(2)->toDateString();
        $firstPayload = [
            'client_operation_id' => (string) Str::uuid(),
            'requested_end_date' => $endDate,
            'proposed_monthly_rent' => 4_250_000,
            'message' => 'Tôi muốn gia hạn.',
        ];
        $secondPayload = array_replace($firstPayload, [
            'client_operation_id' => (string) Str::uuid(),
            'proposed_monthly_rent' => 4_500_000,
        ]);
        $path = '/api/v1/tenant/tenancies/'.$tenancy->id.'/renewal-requests';

        $statuses = Concurrency::driver('process')->run([
            $this->postInProcess($tenant->id, $path, $firstPayload),
            $this->postInProcess($tenant->id, $path, $secondPayload),
        ], timeout: 30);

        sort($statuses);
        $this->assertSame([201, 409], $statuses);
        $this->assertDatabaseCount('tenancy_renewal_requests', 1);
        $this->assertDatabaseCount('audit_logs', 2); // Initial tenant confirmation and renewal request.
        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseCount('idempotency_records', 2);
        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'status' => 'CONFIRMED',
            'confirmed_end_date' => $confirmedEndDate,
            'blocked_end_date' => $tenancy->blocked_end_date,
        ]);
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
