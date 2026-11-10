<?php

namespace Tests\Feature;

use App\Models\RentalRequest;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\Support\EnforcingCsrfMiddleware;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class TenantRentalRequestsTest extends TestCase
{
    use RefreshDatabase;

    private const string PATH = '/api/v1/tenant/rental-requests';

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_guest_cannot_submit_a_request(): void
    {
        $this->postJson(self::PATH, [])->assertUnauthorized();
        $this->assertDatabaseCount('rental_requests', 0);
    }

    #[TestWith([['email_verified_at' => null]])]
    #[TestWith([['account_status' => 'SUSPENDED']])]
    public function test_ineligible_account_cannot_submit(array $attributes): void
    {
        $this->actingAs(User::factory()->create($attributes), 'web')->postJson(self::PATH, [])->assertForbidden();
        $this->assertDatabaseCount('rental_requests', 0);
    }

    public function test_personal_access_token_cannot_submit(): void
    {
        $token = User::factory()->create()->createToken('Read account', ['account:read'], now()->addHour());

        $this->withToken($token->plainTextToken)->postJson(self::PATH, [])->assertForbidden();
        $this->assertDatabaseCount('rental_requests', 0);
    }

    public function test_creates_one_pending_request_and_replays_only_identical_input(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $payload = $this->payload($listing->listingId);

        $this->actingAs($tenant, 'web');
        $response = $this->postJson(self::PATH, $payload)->assertCreated()
            ->assertJsonPath('data.status', 'PENDING')
            ->assertHeader('Cache-Control', 'no-store, private');
        $id = $response->json('data.id');
        $response->assertExactJson(['data' => ['id' => $id, 'status' => 'PENDING']]);

        $tenant->update(['phone' => '0900000000']);
        $this->postJson(self::PATH, array_replace($payload, ['contact_phone' => '0901234567']))
            ->assertOk()->assertExactJson(['data' => ['id' => $id, 'status' => 'PENDING']]);
        $this->postJson(self::PATH, array_replace($payload, ['message' => 'Đổi nội dung']))->assertConflict();
        $this->postJson(self::PATH, array_replace($payload, ['client_operation_id' => (string) Str::uuid()]))->assertConflict();

        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
        $this->assertDatabaseCount('rental_requests', 1);
        $this->assertDatabaseHas('rental_requests', [
            'id' => $id, 'tenant_id' => $tenant->id, 'listing_id' => $listing->listingId,
            'contact_name' => 'Mai Nguyễn', 'contact_phone' => '0901234567',
            'desired_move_in_date' => '2027-01-01', 'desired_end_date' => '2027-03-31',
            'preferred_unit_id' => null, 'message' => '', 'status' => 'PENDING',
        ]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseHas('audit_logs', ['entity_id' => $id, 'actor_id' => $tenant->id, 'correlation_id' => $payload['client_operation_id']]);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseHas('notification_outbox', ['recipient_id' => $listing->owner->id, 'event_key' => 'rental_request.submitted:'.$id]);
        $this->assertDatabaseCount('idempotency_records', 1);
        $this->assertDatabaseCount('tenancies', 0);
    }

    public function test_terminal_request_does_not_block_a_new_request(): void
    {
        $listing = PublicListingFixture::published();
        $this->actingAs(User::factory()->create(), 'web');
        $first = $this->postJson(self::PATH, $this->payload($listing->listingId))->assertCreated()->json('data.id');
        DB::table('rental_requests')->where('id', $first)->update(['status' => 'WITHDRAWN', 'closed_at' => now()]);

        $this->postJson(self::PATH, array_replace($this->payload($listing->listingId), [
            'preferred_unit_id' => $listing->unitIds[0], 'message' => 'Tôi muốn xem căn này.',
        ]))->assertCreated()->assertJsonPath('data.status', 'PENDING');
        $this->assertDatabaseHas('rental_requests', ['id' => $first, 'status' => 'WITHDRAWN']);
        $this->assertDatabaseHas('rental_requests', ['status' => 'PENDING', 'preferred_unit_id' => $listing->unitIds[0], 'message' => 'Tôi muốn xem căn này.']);
    }

    public function test_rejects_bad_input_and_forged_identity(): void
    {
        $listing = PublicListingFixture::published();
        $this->actingAs(User::factory()->create(), 'web')
            ->postJson(self::PATH, array_replace($this->payload($listing->listingId), [
                'contact_name' => '', 'contact_phone' => 'abc', 'desired_end_date' => '2026-12-31',
                'tenant_id' => $listing->owner->id, 'status' => 'ACCEPTED',
            ]))->assertUnprocessable()->assertJsonValidationErrors([
                'contact_name', 'contact_phone', 'desired_end_date', 'tenant_id', 'status',
            ]);

        $this->assertDatabaseCount('rental_requests', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
    }

    public function test_rejects_a_stay_shorter_than_the_minimum(): void
    {
        $listing = PublicListingFixture::published([
            'units' => [
                ['minimum_rental_months' => 3],
                ['label' => 'Studio 2', 'minimum_rental_months' => 6],
            ],
        ]);
        $this->actingAs(User::factory()->create(), 'web');

        $this->postJson(self::PATH, array_replace($this->payload($listing->listingId), [
            'desired_end_date' => '2027-03-30',
        ]))->assertUnprocessable()->assertJsonValidationErrors([
            'desired_end_date' => 'Thời gian thuê phải ít nhất 3 tháng.',
        ]);
        $this->postJson(self::PATH, array_replace($this->payload($listing->listingId), [
            'preferred_unit_id' => $listing->unitIds[1],
            'desired_end_date' => '2027-06-29',
        ]))->assertUnprocessable()->assertJsonValidationErrors([
            'desired_end_date' => 'Thời gian thuê phải ít nhất 6 tháng.',
        ]);

        $this->assertDatabaseCount('rental_requests', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
    }

    public function test_rejects_the_requesters_own_listing(): void
    {
        $listing = PublicListingFixture::published();
        $this->actingAs($listing->owner, 'web')->postJson(self::PATH, $this->payload($listing->listingId))
            ->assertUnprocessable()->assertJsonValidationErrors('listing_id');
        $this->assertDatabaseCount('rental_requests', 0);
    }

    public function test_rejects_hidden_listing_and_another_property_unit(): void
    {
        $listing = PublicListingFixture::published();
        $hidden = PublicListingFixture::published(['publication_status' => 'HIDDEN']);
        $this->actingAs(User::factory()->create(), 'web');

        $this->postJson(self::PATH, $this->payload($hidden->listingId))
            ->assertUnprocessable()->assertJsonValidationErrors('listing_id');
        $this->postJson(self::PATH, array_replace($this->payload($listing->listingId), ['preferred_unit_id' => $hidden->unitIds[0]]))
            ->assertUnprocessable()->assertJsonValidationErrors('preferred_unit_id');
        $this->assertDatabaseCount('rental_requests', 0);
    }

    public function test_enforces_real_csrf_for_browser_submission(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $payload = $this->payload($listing->listingId);
        $this->actingAs($tenant, 'web')->withCredentials();
        config(['sanctum.stateful' => ['localhost:3000'], 'sanctum.middleware.validate_csrf_token' => EnforcingCsrfMiddleware::class]);
        $router = app(Router::class);
        $router->middlewareGroup('web', array_map(fn ($middleware): string => $middleware === PreventRequestForgery::class ? EnforcingCsrfMiddleware::class : $middleware, $router->getMiddlewareGroups()['web']));

        $headers = ['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/listings/'.$listing->listingId];
        $response = $this->withHeaders($headers)->get('/sanctum/csrf-cookie')->assertNoContent();
        $session = $response->getCookie(config('session.cookie'))?->getValue();
        $token = $response->getCookie('XSRF-TOKEN', false)?->getValue();
        $this->assertNotEmpty($session);
        $this->assertNotEmpty($token);

        $this->withCookie(config('session.cookie'), $session)->postJson(self::PATH, $payload)->assertStatus(419);
        $this->assertDatabaseCount('rental_requests', 0);
        $this->withHeaders($headers + ['X-XSRF-TOKEN' => $token])->postJson(self::PATH, $payload)->assertCreated();
        $this->assertDatabaseCount('rental_requests', 1);
    }

    public function test_list_and_detail_are_private_and_keep_the_submitted_contacts(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $foreignTenant = User::factory()->create();
        $own = RentalRequest::factory()->create([
            'listing_id' => $listing->listingId,
            'tenant_id' => $tenant->id,
            'preferred_unit_id' => $listing->unitIds[0],
            'contact_name' => 'Mai lúc gửi',
            'contact_phone' => '0901234567',
            'message' => 'Tôi muốn thuê căn này.',
        ]);
        $foreign = RentalRequest::factory()->create([
            'listing_id' => $listing->listingId, 'tenant_id' => $foreignTenant->id,
        ]);
        $tenant->update(['phone' => '0900000000']);

        $this->getJson(self::PATH)->assertUnauthorized();
        $this->actingAs($tenant, 'web')->getJson(self::PATH.'?filter=pending')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.counts', ['all' => 1, 'pending' => 1, 'accepted' => 0, 'closed' => 0])
            ->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.id', $own->id)
            ->assertJsonMissingPath('data.items.0.contact_phone');
        $this->getJson(self::PATH.'?filter=closed')->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson(self::PATH.'/'.$own->id)->assertOk()
            ->assertJsonPath('data.contact_name', 'Mai lúc gửi')
            ->assertJsonPath('data.contact_phone', '0901234567')
            ->assertJsonPath('data.message', 'Tôi muốn thuê căn này.')
            ->assertJsonPath('data.updated_at', $own->refresh()->updated_at->format('Y-m-d\TH:i:s.uP'));
        $this->getJson(self::PATH.'/'.$foreign->id)->assertNotFound();
        $this->postJson(self::PATH.'/'.$foreign->id.'/withdraw', [
            'expected_updated_at' => $foreign->refresh()->updated_at->format('Y-m-d\TH:i:s.uP'),
            'client_operation_id' => (string) Str::uuid(),
        ])->assertNotFound();
        $this->assertDatabaseHas('rental_requests', ['id' => $foreign->id, 'status' => 'PENDING']);
    }

    public function test_withdraw_checks_current_data_and_records_one_outcome_on_retry(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $request = RentalRequest::factory()->create(['tenant_id' => $tenant->id, 'listing_id' => $listing->listingId]);
        $url = self::PATH.'/'.$request->id.'/withdraw';
        $input = [
            'expected_updated_at' => $request->refresh()->updated_at->format('Y-m-d\TH:i:s.uP'),
            'client_operation_id' => (string) Str::uuid(),
            'reason' => '  Thay đổi kế hoạch  ',
        ];

        $this->actingAs($tenant, 'web')->postJson($url, array_replace($input, ['reason' => str_repeat('a', 501)]))
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson($url, array_replace($input, [
            'expected_updated_at' => $request->updated_at->copy()->subSecond()->format('Y-m-d\TH:i:s.uP'),
        ]))->assertConflict();
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);

        $this->postJson($url, $input)->assertNoContent();
        $this->postJson($url, array_replace($input, ['reason' => 'Thay đổi kế hoạch']))->assertNoContent();
        $this->postJson($url, array_replace($input, ['reason' => 'Nội dung khác']))->assertConflict();
        $this->postJson($url, array_replace($input, ['client_operation_id' => (string) Str::uuid()]))->assertConflict();
        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');

        $this->assertDatabaseHas('rental_requests', [
            'id' => $request->id, 'status' => 'WITHDRAWN', 'outcome_reason' => 'Thay đổi kế hoạch',
        ]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $tenant->id, 'entity_id' => $request->id, 'action' => 'rental_request.withdrawn',
            'correlation_id' => $input['client_operation_id'],
        ]);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseHas('notification_outbox', [
            'recipient_id' => $listing->owner->id, 'event_key' => 'rental_request.withdrawn:'.$request->id,
        ]);
        $this->assertDatabaseCount('idempotency_records', 1);
        $this->assertDatabaseCount('tenancies', 0);
        $this->getJson(self::PATH.'?filter=closed')->assertOk()
            ->assertJsonPath('data.items.0.status', 'WITHDRAWN')
            ->assertJsonPath('data.counts.pending', 0);
    }

    public function test_personal_access_token_cannot_read_or_withdraw_requests(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $request = RentalRequest::factory()->create(['tenant_id' => $tenant->id, 'listing_id' => $listing->listingId]);
        $token = $tenant->createToken('Read account', ['account:read'], now()->addHour());

        $this->withToken($token->plainTextToken)->getJson(self::PATH)->assertForbidden();
        $this->getJson(self::PATH.'/'.$request->id)->assertForbidden();
        $this->postJson(self::PATH.'/'.$request->id.'/withdraw', [
            'expected_updated_at' => $request->refresh()->updated_at->format('Y-m-d\TH:i:s.uP'),
            'client_operation_id' => (string) Str::uuid(),
        ])->assertForbidden();
    }

    public function test_accepted_request_exposes_the_linked_confirmation_state_and_cannot_be_withdrawn(): void
    {
        $listing = PublicListingFixture::published();
        PublicListingFixture::blockUnit($listing->unitIds[0], '2027-01-01', '2027-03-31');
        $request = RentalRequest::query()->where('listing_id', $listing->listingId)->firstOrFail();
        $tenant = User::query()->findOrFail($request->tenant_id);
        $url = self::PATH.'/'.$request->id;

        $this->actingAs($tenant, 'web')->getJson($url)->assertOk()
            ->assertJsonPath('data.status', 'ACCEPTED')
            ->assertJsonPath('data.tenancy.status', 'PENDING_CONFIRMATION')
            ->assertJsonMissingPath('data.tenancy.document_path');
        $this->postJson($url.'/withdraw', [
            'expected_updated_at' => $request->updated_at->format('Y-m-d\TH:i:s.uP'),
            'client_operation_id' => (string) Str::uuid(),
        ])->assertConflict()->assertJsonPath('message', 'Chủ nhà đã gửi đề xuất. Hãy mở Căn hộ và hợp đồng để tiếp tục.');
        $this->assertDatabaseHas('rental_requests', ['id' => $request->id, 'status' => 'ACCEPTED']);
        $this->assertDatabaseHas('tenancies', ['rental_request_id' => $request->id, 'status' => 'PENDING_CONFIRMATION']);
        $this->assertDatabaseCount('notification_outbox', 0);
    }

    /** @return array<string, string> */
    private function payload(string $listingId): array
    {
        return [
            'listing_id' => $listingId,
            'client_operation_id' => (string) Str::uuid(),
            'contact_name' => ' Mai Nguyễn ',
            'contact_phone' => '0901 234 567',
            'desired_move_in_date' => '2027-01-01',
            'desired_end_date' => '2027-03-31',
        ];
    }
}
