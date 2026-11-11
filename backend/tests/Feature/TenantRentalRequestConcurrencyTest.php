<?php

namespace Tests\Feature;

use App\Models\RentalRequest;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class TenantRentalRequestConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    #[TestWith([true, [200, 201]])]
    #[TestWith([false, [201, 409]])]
    public function test_competing_requests_commit_one_request_and_notification(bool $sameOperation, array $expectedStatuses): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $payload = [
            'listing_id' => $listing->listingId,
            'client_operation_id' => (string) Str::uuid(),
            'contact_name' => 'Mai Nguyễn',
            'contact_phone' => '0901234567',
            'desired_move_in_date' => '2027-01-01',
            'desired_end_date' => '2027-03-31',
        ];
        $otherPayload = $sameOperation ? $payload : array_replace($payload, ['client_operation_id' => (string) Str::uuid()]);

        $statuses = Concurrency::driver('process')->run([
            $this->postInProcess($tenant->id, '/api/v1/tenant/rental-requests', $payload),
            $this->postInProcess($tenant->id, '/api/v1/tenant/rental-requests', $otherPayload),
        ], timeout: 20);

        sort($statuses);
        $this->assertSame($expectedStatuses, $statuses);
        $this->assertDatabaseHas('rental_requests', ['tenant_id' => $tenant->id, 'listing_id' => $listing->listingId, 'status' => 'PENDING']);
        $this->assertDatabaseCount('rental_requests', 1);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    public function test_competing_withdrawals_commit_one_outcome(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $request = RentalRequest::factory()->create(['tenant_id' => $tenant->id, 'listing_id' => $listing->listingId])->refresh();
        $path = '/api/v1/tenant/rental-requests/'.$request->id.'/withdraw';
        $payload = [
            'client_operation_id' => (string) Str::uuid(),
            'expected_updated_at' => $request->updated_at->format('Y-m-d\TH:i:s.uP'),
        ];

        $statuses = Concurrency::driver('process')->run([
            $this->postInProcess($tenant->id, $path, $payload),
            $this->postInProcess($tenant->id, $path, array_replace($payload, ['client_operation_id' => (string) Str::uuid()])),
        ], timeout: 20);

        sort($statuses);
        $this->assertSame([204, 409], $statuses);
        $this->assertDatabaseHas('rental_requests', ['id' => $request->id, 'status' => 'WITHDRAWN', 'outcome_reason' => null]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    public function test_withdraw_and_reject_compete_for_the_same_outcome(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $item = RentalRequest::factory()->create(['tenant_id' => $tenant->id, 'listing_id' => $listing->listingId])->refresh();
        $payload = ['expected_updated_at' => $item->updated_at->format('Y-m-d\TH:i:s.uP')];
        $withdraw = $payload + ['client_operation_id' => (string) Str::uuid()];
        $reject = $payload + ['client_operation_id' => (string) Str::uuid(), 'reason' => 'Không có căn phù hợp.'];

        $statuses = Concurrency::driver('process')->run([
            $this->postInProcess($tenant->id, '/api/v1/tenant/rental-requests/'.$item->id.'/withdraw', $withdraw),
            $this->postInProcess($listing->owner->id, '/api/v1/owner/rental-requests/'.$item->id.'/reject', $reject),
        ], timeout: 20);

        $withdrawWon = $statuses[0] === 204;
        $this->assertSame($withdrawWon ? [204, 409] : [409, 204], $statuses);
        $event = $withdrawWon ? 'rental_request.withdrawn' : 'rental_request.rejected';
        $this->assertDatabaseHas('rental_requests', [
            'id' => $item->id,
            'status' => $withdrawWon ? 'WITHDRAWN' : 'REJECTED',
            'outcome_reason' => $withdrawWon ? null : $reject['reason'],
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_id' => $item->id, 'action' => $event, 'actor_id' => $withdrawWon ? $tenant->id : $listing->owner->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'event_key' => $event.':'.$item->id,
            'recipient_id' => $withdrawWon ? $listing->owner->id : $tenant->id,
        ]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    /** @param array<string, string> $payload */
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
