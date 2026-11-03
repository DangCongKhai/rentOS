<?php

namespace Tests\Feature;

use App\Models\Listing;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OwnerListingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_and_edit_a_listing_draft(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $photoId = $this->createMedia($owner->id, $propertyId);
        $payload = [
            'client_operation_id' => (string) Str::uuid(),
            'title' => 'Sunny apartment near campus',
            'description' => 'A spacious, bright apartment with easy access to the university.',
            'cover_media_id' => $photoId,
        ];

        $first = $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $payload);
        $first->assertCreated()->assertJsonPath('data.moderation_status', 'DRAFT')->assertJsonPath('data.publication_status', 'DRAFT');
        $listingId = $first->json('data.id');
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $payload)
            ->assertOk()->assertJsonPath('data.id', $listingId);

        $this->actingAs($owner)->patchJson("/api/v1/owner/properties/{$propertyId}/listing", [
            'expected_content_revision' => 1,
            'title' => 'Sunny apartment by campus',
        ])->assertOk()->assertJsonPath('data.title', 'Sunny apartment by campus')->assertJsonPath('data.property_content_revision', 2);

        $this->assertDatabaseHas('audit_logs', ['entity_type' => 'listing', 'entity_id' => $listingId, 'action' => 'listing.created']);
        $this->assertDatabaseHas('audit_logs', ['entity_type' => 'listing', 'entity_id' => $listingId, 'action' => 'listing.updated']);
    }

    public function test_owner_cannot_create_a_second_current_listing_or_use_another_property_cover(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $otherPropertyId = $this->createProperty($owner->id);
        $otherPhoto = $this->createMedia($owner->id, $otherPropertyId);
        $payload = $this->listingPayload($otherPhoto);

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('cover_media_id');

        $payload['cover_media_id'] = null;
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $payload)->assertCreated();
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload(null))
            ->assertConflict();
    }

    public function test_listing_submission_requires_complete_property_and_units(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload(null))->assertCreated();

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors(['property.address_line', 'cover_media_id', 'units']);

        $this->assertDatabaseHas('listings', ['property_id' => $propertyId, 'moderation_status' => 'DRAFT']);
    }

    public function test_listing_submission_requires_selected_live_media_for_each_ready_marketed_unit(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createCompleteProperty($owner->id);
        $unitId = (string) DB::table('units')->where('property_id', $propertyId)->value('id');
        $coverId = $this->createMedia($owner->id, $propertyId);
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload($coverId))->assertCreated();
        DB::table('property_media')->where('unit_id', $unitId)->update(['is_selected_for_listing' => false]);

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors("units.{$unitId}.photos");

        DB::table('property_media')->where('unit_id', $unitId)->update(['is_selected_for_listing' => true]);
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertOk()->assertJsonPath('data.moderation_status', 'PENDING');
    }

    public function test_editing_a_pending_listing_invalidates_its_submitted_snapshot(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createCompleteProperty($owner->id);
        $coverId = $this->createMedia($owner->id, $propertyId);
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload($coverId))->assertCreated();
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertOk();

        $response = $this->actingAs($owner)->patchJson("/api/v1/owner/properties/{$propertyId}/listing", [
            'expected_content_revision' => 1,
            'title' => 'Updated listing title',
        ]);

        $response->assertOk()->assertJsonPath('data.moderation_status', 'DRAFT')
            ->assertJsonPath('data.submitted_content_revision', null)
            ->assertJsonPath('data.property_content_revision', 2);

        $admin = User::factory()->create();
        DB::table('users')->where('id', $admin->id)->update(['is_admin' => true]);
        $admin->refresh();
        $listingId = DB::table('listings')->where('property_id', $propertyId)->value('id');
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$listingId}/approve")
            ->assertConflict();
    }

    public function test_admin_rejection_requires_a_reason_and_owner_can_resubmit(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createCompleteProperty($owner->id);
        $coverId = $this->createMedia($owner->id, $propertyId);
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload($coverId))->assertCreated();
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertOk();

        $admin = User::factory()->create();
        DB::table('users')->where('id', $admin->id)->update(['is_admin' => true]);
        $admin->refresh();
        $listingId = DB::table('listings')->where('property_id', $propertyId)->value('id');
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$listingId}/reject", ['reason' => ''])->assertUnprocessable();
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$listingId}/reject", ['reason' => 'Please add unit details.'])
            ->assertOk()->assertJsonPath('data.moderation_status', 'REJECTED');

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertOk()->assertJsonPath('data.moderation_status', 'PENDING')->assertJsonPath('data.review_reason', null);
    }

    public function test_complete_listing_requires_admin_approval_before_owner_can_publish(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createCompleteProperty($owner->id);
        $coverId = $this->createMedia($owner->id, $propertyId);
        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload($coverId))->assertCreated();

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertOk()->assertJsonPath('data.moderation_status', 'PENDING');

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/publish", [
            'expected_content_revision' => 1,
        ])->assertUnprocessable();

        $admin = User::factory()->create();
        DB::table('users')->where('id', $admin->id)->update(['is_admin' => true]);
        $admin->refresh();
        $listingId = DB::table('listings')->where('property_id', $propertyId)->value('id');
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$listingId}/approve")->assertOk()
            ->assertJsonPath('data.moderation_status', 'APPROVED')->assertJsonPath('data.publication_status', 'DRAFT');

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/publish", [
            'expected_content_revision' => 1,
        ])->assertOk()->assertJsonPath('data.publication_status', 'PUBLISHED');
        $this->assertSame(1, Listing::query()->publiclyVisible()->count());

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/hide", [
            'expected_content_revision' => 1,
        ])->assertOk()->assertJsonPath('data.publication_status', 'HIDDEN');
        $this->assertSame(0, Listing::query()->publiclyVisible()->count());

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/publish", [
            'expected_content_revision' => 1,
        ])->assertOk();
        DB::table('listings')->where('property_id', $propertyId)->update([
            'admin_suspended_at' => now(), 'admin_suspended_by' => $admin->id, 'suspension_reason' => 'Test suspension',
        ]);
        $this->assertSame(0, Listing::query()->publiclyVisible()->count());
    }

    public function test_owner_can_open_a_listing_by_its_id_and_share_a_property_photo_with_a_unit(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createCompleteProperty($owner->id);
        $coverId = $this->createMedia($owner->id, $propertyId);
        $created = $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload($coverId));
        $created->assertCreated();
        $listingId = $created->json('data.id');

        $this->actingAs($owner)->getJson("/api/v1/owner/listings/{$listingId}")
            ->assertOk()
            ->assertJsonPath('data.id', $listingId)
            ->assertJsonPath('data.property_id', $propertyId);

        $unitId = (string) DB::table('units')->where('property_id', $propertyId)->value('id');
        DB::table('property_media')->where('property_id', $propertyId)->where('unit_id', $unitId)->delete();

        $this->actingAs($owner)->putJson("/api/v1/owner/properties/{$propertyId}/units/{$unitId}/shared-media", [
            'expected_content_revision' => 1,
            'media_ids' => [$coverId],
        ])->assertOk()->assertJsonPath('data.content_revision', 2);

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 2,
        ])->assertOk()->assertJsonPath('data.moderation_status', 'PENDING');
    }

    public function test_marketed_maintenance_unit_does_not_block_submission_if_a_ready_unit_is_complete(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createCompleteProperty($owner->id);
        $coverId = $this->createMedia($owner->id, $propertyId);
        $maintenanceUnitId = (string) Str::uuid();
        DB::table('units')->insert([
            'id' => $maintenanceUnitId,
            'property_id' => $propertyId,
            'client_operation_id' => (string) Str::uuid(),
            'label' => 'Unit under maintenance',
            'unit_kind' => 'ROOM',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 3,
            'operational_status' => 'MAINTENANCE',
            'is_marketed' => true,
        ]);

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing", $this->listingPayload($coverId))->assertCreated();

        $this->actingAs($owner)->postJson("/api/v1/owner/properties/{$propertyId}/listing/submit", [
            'expected_content_revision' => 1,
        ])->assertOk()->assertJsonPath('data.moderation_status', 'PENDING');
    }

    private function listingPayload(?string $coverId): array
    {
        return [
            'client_operation_id' => (string) Str::uuid(),
            'title' => 'Sunny apartment near campus',
            'description' => 'A spacious, bright apartment with easy access to the university.',
            'cover_media_id' => $coverId,
        ];
    }

    private function createProperty(string $ownerId): string
    {
        $id = (string) Str::uuid();
        DB::table('properties')->insert([
            'id' => $id, 'owner_id' => $ownerId, 'client_operation_id' => (string) Str::uuid(),
            'name' => 'Test property', 'property_type' => 'APARTMENT', 'rental_arrangement' => 'SEPARATE_UNITS',
            'city' => 'Da Nang', 'policies' => json_encode(['schema_version' => 1, 'pets' => 'ALLOWED', 'smoking' => 'NOT_ALLOWED', 'shared_rules' => []]),
        ]);

        return $id;
    }

    private function createCompleteProperty(string $ownerId): string
    {
        $id = $this->createProperty($ownerId);
        DB::table('properties')->where('id', $id)->update([
            'address_line' => '123 Test Street', 'description' => 'A well maintained apartment in a central neighborhood.',
        ]);
        $unitId = (string) Str::uuid();
        DB::table('units')->insert([
            'id' => $unitId, 'property_id' => $id, 'client_operation_id' => (string) Str::uuid(), 'label' => 'Unit A',
            'unit_kind' => 'APARTMENT', 'description' => 'A complete test unit.', 'area_m2' => 50, 'bedrooms' => 1,
            'bathrooms' => 1, 'bathroom_arrangement' => 'PRIVATE', 'minimum_rental_months' => 3,
            'advertised_monthly_rent' => 10000000, 'deposit' => 10000000, 'max_occupants' => 2,
            'operational_status' => 'READY', 'is_marketed' => true,
        ]);
        DB::table('property_media')->insert([
            'id' => (string) Str::uuid(), 'property_id' => $id, 'unit_id' => $unitId, 'uploaded_by' => $ownerId,
            'client_operation_id' => (string) Str::uuid(), 'storage_path' => "properties/{$id}/units/{$unitId}/test.jpg",
            'sha256' => str_repeat('a', 64), 'mime_type' => 'image/jpeg', 'size_bytes' => 100,
            'is_selected_for_listing' => true,
        ]);

        return $id;
    }

    private function createMedia(string $ownerId, string $propertyId): string
    {
        $id = (string) Str::uuid();
        DB::table('property_media')->insert([
            'id' => $id, 'property_id' => $propertyId, 'uploaded_by' => $ownerId,
            'client_operation_id' => (string) Str::uuid(), 'storage_path' => "properties/{$propertyId}/shared/{$id}.jpg",
            'sha256' => str_repeat('b', 64), 'mime_type' => 'image/jpeg', 'size_bytes' => 100, 'is_selected_for_listing' => true,
        ]);

        return $id;
    }
}
