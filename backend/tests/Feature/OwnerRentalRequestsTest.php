<?php

namespace Tests\Feature;

use App\Models\RentalRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class OwnerRentalRequestsTest extends TestCase
{
    use RefreshDatabase;

    private const string OWNER = '/api/v1/owner/rental-requests';

    private const string TENANT = '/api/v1/tenant/rental-requests';

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_owner_reads_only_their_inbox_sorted_oldest_first_and_gets_contact_snapshots(): void
    {
        $listing = PublicListingFixture::published();
        $foreignListing = PublicListingFixture::published();
        $newer = RentalRequest::factory()->create(['listing_id' => $listing->listingId, 'created_at' => now()]);
        $older = RentalRequest::factory()->create([
            'listing_id' => $listing->listingId, 'created_at' => now()->subDay(),
            'contact_name' => 'Tên khi gửi', 'contact_phone' => '0900111222', 'message' => 'Muốn xem căn.',
        ]);
        $foreign = RentalRequest::factory()->create(['listing_id' => $foreignListing->listingId]);
        User::query()->whereKey($older->tenant_id)->update(['phone' => '0900999999']);

        $this->getJson(self::OWNER)->assertUnauthorized();
        $this->actingAs($listing->owner, 'web')->getJson(self::OWNER)->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.counts.PENDING', 2)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.id', $older->id)
            ->assertJsonPath('data.items.1.id', $newer->id)
            ->assertJsonPath('data.items.0.contact_phone', '0900111222')
            ->assertJsonMissingPath('data.items.0.message');
        $this->getJson(self::OWNER.'/'.$older->id)->assertOk()
            ->assertJsonPath('data.contact_name', 'Tên khi gửi')
            ->assertJsonPath('data.message', 'Muốn xem căn.');
        $this->getJson(self::OWNER.'/'.$foreign->id)->assertNotFound();
        $this->postJson(self::OWNER.'/'.$foreign->id.'/reject', $this->payload($foreign))->assertNotFound();
        $this->assertDatabaseHas('rental_requests', ['id' => $foreign->id, 'status' => 'PENDING']);
    }

    public function test_detail_excludes_blocks_touching_the_requested_end_but_allows_adjacent_rentals(): void
    {
        $listing = PublicListingFixture::published(['units' => [
            ['label' => 'Căn ưu tiên'], ['label' => 'Căn sát ngày'], ['label' => 'Căn trùng ngày'],
        ]]);
        PublicListingFixture::blockUnit($listing->unitIds[0], '2027-02-01', '2027-04-30');
        PublicListingFixture::blockUnit($listing->unitIds[1], '2027-04-01', '2027-06-30');
        PublicListingFixture::blockUnit($listing->unitIds[2], '2027-03-31', '2027-06-30');
        $item = RentalRequest::factory()->create([
            'listing_id' => $listing->listingId, 'preferred_unit_id' => $listing->unitIds[0],
            'desired_move_in_date' => '2027-01-01', 'desired_end_date' => '2027-03-31',
        ]);

        $this->actingAs($listing->owner, 'web')->getJson(self::OWNER.'/'.$item->id)->assertOk()
            ->assertJsonPath('data.preferred_unit_available', false)
            ->assertJsonCount(1, 'data.alternative_units')
            ->assertJsonPath('data.alternative_units.0.id', $listing->unitIds[1]);
        $this->assertDatabaseCount('tenancies', 3);
    }

    public function test_submitted_request_is_rejected_once_and_the_tenant_sees_the_reason(): void
    {
        $listing = PublicListingFixture::published();
        $tenant = User::factory()->create();
        $id = $this->actingAs($tenant, 'web')->postJson(self::TENANT, [
            'listing_id' => $listing->listingId,
            'client_operation_id' => (string) Str::uuid(),
            'contact_name' => 'Mai',
            'contact_phone' => '0901234567',
            'desired_move_in_date' => '2027-01-01',
            'desired_end_date' => '2027-03-31',
        ])->assertCreated()->json('data.id');
        $item = RentalRequest::query()->findOrFail($id);
        $url = self::OWNER.'/'.$id.'/reject';
        $payload = $this->payload($item);

        Auth::forgetGuards();
        $this->actingAs($listing->owner, 'web')->postJson($url, array_replace($payload, ['reason' => '  ']))
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson($url, array_replace($payload, [
            'expected_updated_at' => $item->updated_at->copy()->subSecond()->format('Y-m-d\TH:i:s.uP'),
        ]))->assertConflict();
        $this->postJson($url, $payload)->assertNoContent();
        $this->postJson($url, array_replace($payload, ['reason' => trim($payload['reason'])]))->assertNoContent();
        $this->postJson($url, array_replace($payload, ['reason' => 'Lý do khác']))->assertConflict();
        $this->postJson($url, array_replace($payload, ['client_operation_id' => (string) Str::uuid()]))->assertConflict();
        $this->getJson(self::OWNER.'?status=REJECTED')->assertOk()
            ->assertJsonPath('data.counts.PENDING', 0)->assertJsonPath('data.items.0.id', $id);

        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $listing->owner->id, 'entity_id' => $id, 'action' => 'rental_request.rejected',
            'reason' => trim($payload['reason']), 'correlation_id' => $payload['client_operation_id'],
        ]);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $tenant->id,
            'audience' => 'TENANT',
            'event_key' => 'rental_request.rejected:'.$id,
        ]);
        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseCount('idempotency_records', 2);
        $this->assertDatabaseCount('tenancies', 0);
        Auth::forgetGuards();
        $this->actingAs($tenant, 'web')->getJson(self::TENANT.'/'.$id)->assertOk()
            ->assertJsonPath('data.status', 'REJECTED')->assertJsonPath('data.outcome_reason', trim($payload['reason']));
    }

    public function test_personal_token_cannot_read_or_reject_inbox_requests(): void
    {
        $listing = PublicListingFixture::published();
        $item = RentalRequest::factory()->create(['listing_id' => $listing->listingId]);
        $token = $listing->owner->createToken('Read account', ['account:read'], now()->addHour());

        $this->withToken($token->plainTextToken)->getJson(self::OWNER)->assertForbidden();
        $this->getJson(self::OWNER.'/'.$item->id)->assertForbidden();
        $this->postJson(self::OWNER.'/'.$item->id.'/reject', $this->payload($item))->assertForbidden();
    }

    /** @return array<string, string> */
    private function payload(RentalRequest $item): array
    {
        return [
            'client_operation_id' => (string) Str::uuid(),
            'expected_updated_at' => $item->updated_at->format('Y-m-d\TH:i:s.uP'),
            'reason' => '  Không có căn phù hợp.  ',
        ];
    }
}
