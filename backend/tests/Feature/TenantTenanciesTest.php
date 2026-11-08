<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantTenanciesTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_tenant_tenancies(): void
    {
        $response = $this->getJson('/api/v1/tenant/tenancies');
        $response->assertUnauthorized();
    }

    public function test_user_without_tenancies_returns_empty_array(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/tenant/tenancies');

        $response->assertOk()
            ->assertJson([
                'data' => [],
            ])
            ->assertJsonMissing(['is_tenant', 'is_owner', 'properties_count']);
    }

    private function validPolicies(): string
    {
        return json_encode([
            'schema_version' => 1,
            'pets' => 'ALLOWED',
            'smoking' => 'NOT_ALLOWED',
            'shared_rules' => [],
        ], JSON_THROW_ON_ERROR);
    }

    private function createTenancy(
        string $tenantId,
        string $ownerId,
        string $status = 'ACTIVE',
        array $extraAttributes = []
    ): string {
        $propertyId = Str::uuid()->toString();
        DB::table('properties')->insert([
            'id' => $propertyId,
            'owner_id' => $ownerId,
            'client_operation_id' => Str::uuid()->toString(),
            'name' => 'Can ho Landmark',
            'property_type' => 'APARTMENT',
            'rental_arrangement' => 'WHOLE_SPACE',
            'city' => 'Ho Chi Minh',
            'policies' => $this->validPolicies(),
            'archived_at' => null,
        ]);

        $unitId = Str::uuid()->toString();
        DB::table('units')->insert([
            'id' => $unitId,
            'property_id' => $propertyId,
            'client_operation_id' => Str::uuid()->toString(),
            'label' => 'Phong 101',
            'unit_kind' => 'APARTMENT',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 6,
        ]);

        $listingId = Str::uuid()->toString();
        DB::table('listings')->insert([
            'id' => $listingId,
            'property_id' => $propertyId,
            'client_operation_id' => Str::uuid()->toString(),
            'title' => 'Can ho cho thue',
            'description' => 'Mo ta chi tiet can ho',
            'moderation_status' => 'APPROVED',
            'publication_status' => 'PUBLISHED',
        ]);

        $rentalRequestId = Str::uuid()->toString();
        DB::table('rental_requests')->insert([
            'id' => $rentalRequestId,
            'listing_id' => $listingId,
            'tenant_id' => $tenantId,
            'preferred_unit_id' => $unitId,
            'client_operation_id' => Str::uuid()->toString(),
            'desired_move_in_date' => '2026-11-01',
            'desired_end_date' => '2027-05-01',
            'message' => 'Toi muon thue can ho nay',
            'contact_name' => 'Nguoi Thue Test',
            'contact_phone' => '0901234567',
            'status' => 'ACCEPTED',
            'closed_at' => now(),
        ]);

        $tenancyId = Str::uuid()->toString();
        $baseTenancy = [
            'id' => $tenancyId,
            'unit_id' => $unitId,
            'tenant_id' => $tenantId,
            'owner_id' => $ownerId,
            'rental_request_id' => $rentalRequestId,
            'client_operation_id' => Str::uuid()->toString(),
            'status' => $status,
            'confirmed_start_date' => '2026-11-01',
            'confirmed_end_date' => '2027-05-01',
            'blocked_start_date' => '2026-11-01',
            'blocked_end_date' => '2027-05-01',
            'moved_in_at' => $status === 'ACTIVE' ? now() : null,
        ];

        DB::table('tenancies')->insert(array_merge($baseTenancy, $extraAttributes));

        return $tenancyId;
    }

    public function test_active_and_confirmed_tenancies_are_returned(): void
    {
        $owner = User::factory()->create();
        $tenant = User::factory()->create();

        $activeTenancyId = $this->createTenancy($tenant->id, $owner->id, 'ACTIVE');
        $confirmedTenancyId = $this->createTenancy($tenant->id, $owner->id, 'CONFIRMED');

        $response = $this->actingAs($tenant)->getJson('/api/v1/tenant/tenancies');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonMissing(['is_tenant', 'is_owner', 'properties_count']);

        $returnedIds = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($activeTenancyId, $returnedIds);
        $this->assertContains($confirmedTenancyId, $returnedIds);
    }

    public function test_historical_tenancies_are_returned_for_timeline(): void
    {
        $owner = User::factory()->create();
        $tenant = User::factory()->create();

        $expectedStatuses = [
            'AWAITING_REVISION' => $this->createTenancy($tenant->id, $owner->id, 'AWAITING_REVISION', [
                'blocked_start_date' => null,
                'blocked_end_date' => null,
                'moved_in_at' => null,
            ]),

            'CANCELLED' => $this->createTenancy($tenant->id, $owner->id, 'CANCELLED', [
                'blocked_start_date' => null,
                'blocked_end_date' => null,
                'moved_in_at' => null,
                'actual_ended_at' => now(),
                'end_reason' => 'Nguoi thue huy bo',
            ]),

            'ENDED' => $this->createTenancy($tenant->id, $owner->id, 'ENDED', [
                'blocked_start_date' => '2026-05-01',
                'blocked_end_date' => '2026-10-01',
                'moved_in_at' => now()->subMonths(6),
                'actual_ended_at' => now(),
                'end_reason' => 'Ket thuc thoi han hop dong',
            ]),

            'EXPIRED' => $this->createTenancy($tenant->id, $owner->id, 'EXPIRED', [
                'blocked_start_date' => null,
                'blocked_end_date' => null,
                'moved_in_at' => null,
                'actual_ended_at' => now(),
                'end_reason' => 'Qua han xac nhan hop dong',
            ]),
        ];

        $response = $this->actingAs($tenant)->getJson('/api/v1/tenant/tenancies');

        $response->assertOk()
            ->assertJsonCount(4, 'data');

        $returned = collect($response->json('data'))->keyBy('id');

        foreach ($expectedStatuses as $status => $id) {
            $this->assertSame($status, $returned->get($id)['status'] ?? null);
        }
    }

    public function test_user_cannot_view_other_tenants_tenancies(): void
    {
        $owner = User::factory()->create();
        $tenantA = User::factory()->create();
        $tenantB = User::factory()->create();

        $this->createTenancy($tenantA->id, $owner->id, 'ACTIVE');

        $response = $this->actingAs($tenantB)->getJson('/api/v1/tenant/tenancies');

        $response->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJson(['data' => []]);
    }
}
