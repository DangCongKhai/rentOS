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

class OwnerTenancyRenewalProposalConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_concurrent_owner_tabs_create_only_one_pending_renewal_version(): void
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

        $this->actingAs($tenant, 'web')->postJson(
            '/api/v1/tenant/tenancies/'.$tenancy->id.'/renewal-requests',
            [
                'client_operation_id' => (string) Str::uuid(),
                'requested_end_date' => CarbonImmutable::parse($endDate)->addMonthsNoOverflow(2)->toDateString(),
                'proposed_monthly_rent' => 3_800_000,
                'message' => 'Tôi muốn gia hạn kỳ thuê.',
            ],
        )->assertCreated();
        $renewal = DB::table('tenancy_renewal_requests')->where('tenancy_id', $tenancy->id)->firstOrFail();

        $path = '/api/v1/owner/tenancies/'.$tenancy->id.'/renewal-requests/'.$renewal->id.'/proposal';
        $firstPayload = $this->proposalPayload((string) Str::uuid(), $endDate, 4_200_000);
        $secondPayload = $this->proposalPayload((string) Str::uuid(), $endDate, 4_500_000);
        $extensionEndDate = $firstPayload['end_date'];
        $statuses = Concurrency::driver('process')->run([
            $this->postInProcess($listing->owner->id, $path, $firstPayload),
            $this->postInProcess($listing->owner->id, $path, $secondPayload),
        ], timeout: 30);

        sort($statuses);
        $this->assertSame([201, 409], $statuses);
        $this->assertDatabaseCount('tenancy_contracts', 2);
        $this->assertDatabaseHas('tenancy_renewal_requests', [
            'id' => $renewal->id,
            'status' => 'PENDING',
        ]);
        $this->assertDatabaseHas('tenancies', [
            'id' => $tenancy->id,
            'confirmed_end_date' => $endDate,
            'blocked_end_date' => $extensionEndDate,
            'pending_contract_id' => DB::table('tenancy_contracts')
                ->where('tenancy_id', $tenancy->id)
                ->where('type', 'RENEWAL')
                ->value('id'),
        ]);
        $this->assertDatabaseCount('audit_logs', 3); // Confirmation, renewal request, one proposal.
        $this->assertDatabaseCount('notifications', 3);
        $this->assertDatabaseCount('idempotency_records', 3);
    }

    /** @param array<string, string|int|array<string, mixed>> $payload */
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

    /** @return array{client_operation_id: string, end_date: string, monthly_rent: int, deposit_amount: int, policies_snapshot: array<string, mixed>} */
    private function proposalPayload(string $operationId, string $endDate, int $rent): array
    {
        return [
            'client_operation_id' => $operationId,
            'end_date' => CarbonImmutable::parse($endDate)->addMonthsNoOverflow(3)->toDateString(),
            'monthly_rent' => $rent,
            'deposit_amount' => $rent,
            'policies_snapshot' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => [],
            ],
        ];
    }
}
