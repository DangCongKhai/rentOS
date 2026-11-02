<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class OwnerPropertiesTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_owner_properties(): void
    {
        $response = $this->getJson('/api/v1/owner/properties');
        $response->assertUnauthorized();
    }

    public function test_guest_cannot_create_property(): void
    {
        $this->postJson('/api/v1/owner/properties', $this->validProperty())
            ->assertUnauthorized();
    }

    public function test_unverified_owner_cannot_create_property(): void
    {
        $owner = User::factory()->unverified()->create();

        $this->actingAs($owner)
            ->postJson('/api/v1/owner/properties', $this->validProperty())
            ->assertForbidden();

        $this->assertDatabaseCount('properties', 0);
    }

    public function test_owner_can_create_incomplete_whole_space_property_atomically(): void
    {
        $owner = User::factory()->create();
        $attributes = $this->validProperty();

        $response = $this->actingAs($owner)
            ->postJson('/api/v1/owner/properties', $attributes);

        $response->assertCreated()
            ->assertJsonPath('data.owner_id', $owner->id)
            ->assertJsonPath('data.content_revision', 1)
            ->assertJsonPath('data.address_line', null)
            ->assertJsonCount(1, 'data.units')
            ->assertJsonPath('data.units.0.label', 'Entire apartment')
            ->assertJsonPath('data.units.0.is_marketed', false);

        $propertyId = $response->json('data.id');
        $this->assertDatabaseCount('properties', 1);
        $this->assertDatabaseCount('units', 1);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'owner_id' => $owner->id,
            'client_operation_id' => $attributes['client_operation_id'],
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'property',
            'entity_id' => $propertyId,
            'action' => 'property.created',
        ]);
        $this->assertDatabaseHas('idempotency_records', [
            'actor_id' => $owner->id,
            'action' => 'property.create',
            'client_operation_id' => $attributes['client_operation_id'],
        ]);
    }

    public function test_separate_unit_property_does_not_create_an_automatic_unit(): void
    {
        $owner = User::factory()->create();
        $attributes = $this->validProperty(['rental_arrangement' => 'SEPARATE_UNITS']);

        $this->actingAs($owner)
            ->postJson('/api/v1/owner/properties', $attributes)
            ->assertCreated()
            ->assertJsonCount(0, 'data.units');

        $this->assertDatabaseCount('properties', 1);
        $this->assertDatabaseCount('units', 0);
    }

    public function test_replaying_property_create_returns_same_result_without_duplicates(): void
    {
        $owner = User::factory()->create();
        $attributes = $this->validProperty();

        $first = $this->actingAs($owner)->postJson('/api/v1/owner/properties', $attributes);
        $first->assertCreated();

        $this->actingAs($owner)
            ->postJson('/api/v1/owner/properties', $attributes)
            ->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertDatabaseCount('properties', 1);
        $this->assertDatabaseCount('units', 1);
        $this->assertDatabaseCount('audit_logs', 1);
    }

    public function test_reusing_property_operation_id_with_changed_payload_returns_conflict(): void
    {
        $owner = User::factory()->create();
        $attributes = $this->validProperty();
        $this->actingAs($owner)->postJson('/api/v1/owner/properties', $attributes)->assertCreated();

        $attributes['name'] = 'Changed name';
        $this->actingAs($owner)
            ->postJson('/api/v1/owner/properties', $attributes)
            ->assertConflict();

        $this->assertDatabaseCount('properties', 1);
        $this->assertDatabaseCount('units', 1);
    }

    public function test_owner_cannot_forge_property_owner_or_submit_removed_district_field(): void
    {
        $owner = User::factory()->create();
        $attributes = $this->validProperty(['owner_id' => (string) Str::uuid()]);

        $this->actingAs($owner)
            ->postJson('/api/v1/owner/properties', $attributes)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('owner_id');

        unset($attributes['owner_id']);
        $attributes['district'] = 'District 1';
        $this->actingAs($owner)
            ->postJson('/api/v1/owner/properties', $attributes)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('district');

        $this->assertDatabaseCount('properties', 0);
    }

    public function test_personal_access_token_cannot_create_owner_property(): void
    {
        $owner = User::factory()->create();
        $token = $owner->createToken('owner script', ['account:read'], now()->addHour())->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/owner/properties', $this->validProperty())
            ->assertForbidden();

        $this->assertDatabaseCount('properties', 0);
    }

    public function test_user_without_properties_returns_empty_array(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/owner/properties');

        $response->assertOk()
            ->assertJson([
                'data' => [],
            ])
            ->assertJsonMissing(['is_tenant', 'is_owner', 'tenancies_count']);
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

    private function createProperty(
        string $ownerId,
        ?string $archivedAt = null,
        string $rentalArrangement = 'WHOLE_SPACE'): string
    {
        $propertyId = Str::uuid()->toString();

        DB::table('properties')->insert([
            'id' => $propertyId,
            'owner_id' => $ownerId,
            'client_operation_id' => Str::uuid()->toString(),
            'name' => 'Can ho Landmark '.Str::random(4),
            'property_type' => 'APARTMENT',
            'rental_arrangement' => $rentalArrangement,
            'city' => 'Ho Chi Minh',
            'policies' => $this->validPolicies(),
            'archived_at' => $archivedAt,
        ]);

        return $propertyId;
    }

    public function test_active_properties_are_returned(): void
    {
        $owner = User::factory()->create();

        $prop1 = $this->createProperty($owner->id, null);
        $prop2 = $this->createProperty($owner->id, null);

        $response = $this->actingAs($owner)->getJson('/api/v1/owner/properties');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonMissing(['is_tenant', 'is_owner', 'tenancies_count']);

        $returnedIds = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($prop1, $returnedIds);
        $this->assertContains($prop2, $returnedIds);
    }

    public function test_archived_properties_are_excluded(): void
    {
        $owner = User::factory()->create();

        $activePropId = $this->createProperty($owner->id, null);
        $this->createProperty($owner->id, now()->toIso8601String());

        $response = $this->actingAs($owner)->getJson('/api/v1/owner/properties');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $activePropId);
    }

    public function test_user_cannot_view_other_owners_properties(): void
    {
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $this->createProperty($ownerA->id, null);

        $response = $this->actingAs($ownerB)->getJson('/api/v1/owner/properties');

        $response->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJson(['data' => []]);
    }

    public function test_owner_can_view_one_property_and_foreign_owner_cannot(): void
    {
        $owner = User::factory()->create();
        $otherOwner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);

        $this->actingAs($owner)
            ->getJson("/api/v1/owner/properties/{$propertyId}")
            ->assertOk()
            ->assertJsonPath('data.id', $propertyId);

        $this->actingAs($otherOwner)
            ->getJson("/api/v1/owner/properties/{$propertyId}")
            ->assertForbidden();
    }

    public function test_owner_can_update_property_with_current_content_revision(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);

        $this->actingAs($owner)
            ->patchJson("/api/v1/owner/properties/{$propertyId}", [
                'name' => 'Updated apartment',
                'expected_content_revision' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated apartment')
            ->assertJsonPath('data.content_revision', 2);

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'name' => 'Updated apartment',
            'content_revision' => 2,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'property',
            'entity_id' => $propertyId,
            'action' => 'property.updated',
        ]);
    }

    public function test_stale_property_update_returns_conflict_without_overwriting_data(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);

        $this->actingAs($owner)->patchJson("/api/v1/owner/properties/{$propertyId}", [
            'name' => 'First edit',
            'expected_content_revision' => 1,
        ])->assertOk();

        $this->actingAs($owner)->patchJson("/api/v1/owner/properties/{$propertyId}", [
            'name' => 'Stale edit',
            'expected_content_revision' => 1,
        ])->assertConflict();

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'name' => 'First edit',
            'content_revision' => 2,
        ]);
    }

    public function test_foreign_owner_cannot_update_or_archive_property(): void
    {
        $owner = User::factory()->create();
        $otherOwner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);

        $this->actingAs($otherOwner)->patchJson("/api/v1/owner/properties/{$propertyId}", [
            'name' => 'Forged update',
            'expected_content_revision' => 1,
        ])->assertForbidden();

        $this->actingAs($otherOwner)->patchJson("/api/v1/owner/properties/{$propertyId}/archive", [
            'expected_content_revision' => 1,
        ])->assertForbidden();

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'owner_id' => $owner->id,
            'archived_at' => null,
        ]);
    }

    public function test_archiving_preserves_property_and_units_and_removes_property_from_active_list(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        DB::table('units')->insert([
            'id' => (string) Str::uuid(),
            'property_id' => $propertyId,
            'client_operation_id' => (string) Str::uuid(),
            'label' => 'Unit 101',
            'unit_kind' => 'APARTMENT',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 3,
        ]);

        $response = $this->actingAs($owner)
            ->patchJson("/api/v1/owner/properties/{$propertyId}/archive", ['expected_content_revision' => 1])
            ->assertOk();
        $this->assertNotNull($response->json('data.archived_at'));

        $this->actingAs($owner)->getJson('/api/v1/owner/properties')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($owner)->getJson("/api/v1/owner/properties/{$propertyId}")->assertOk();
        $this->assertDatabaseCount('units', 1);
        $this->assertDatabaseHas('properties', ['id' => $propertyId, 'content_revision' => 2]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function validProperty(array $overrides = []): array
    {
        return array_merge([
            'client_operation_id' => (string) Str::uuid(),
            'name' => 'Can ho Landmark',
            'property_type' => 'APARTMENT',
            'rental_arrangement' => 'WHOLE_SPACE',
        ], $overrides);
    }

    public function test_owner_can_create_unit_for_separate_unit_property(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );

        $operationId = (string) Str::uuid();

        $response = $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units",
            [
                'client_operation_id' => $operationId,
                'label' => 'Room 101',
                'unit_kind' => 'ROOM',
                'bedrooms' => 1,
                'bathrooms' => 1,
                'bathroom_arrangement' => 'PRIVATE',
                'minimum_rental_months' => 3,
            ],
        );

        $response->assertCreated()
            ->assertJsonPath('data.property_id', $propertyId)
            ->assertJsonPath('data.label', 'Room 101')
            ->assertJsonPath('data.operational_status', 'READY')
            ->assertJsonPath('data.is_marketed', false);

        $unitId = $response->json('data.id');

        $this->assertDatabaseHas('units', [
            'id' => $unitId,
            'property_id' => $propertyId,
            'client_operation_id' => $operationId,
            'label' => 'Room 101',
        ]);

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'unit',
            'entity_id' => $unitId,
            'action' => 'unit.created',
        ]);
    }

    public function test_foreign_owner_cannot_create_unit_for_another_owners_property(): void
    {
        $owner = User::factory()->create();
        $otherOwner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );

        $this->actingAs($otherOwner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units",
            [
                'client_operation_id' => (string) Str::uuid(),
                'label' => 'Room 101',
                'unit_kind' => 'ROOM',
                'bedrooms' => 1,
                'bathrooms' => 1,
                'bathroom_arrangement' => 'PRIVATE',
                'minimum_rental_months' => 3,
            ],
        )->assertForbidden();

        $this->assertDatabaseCount('units', 0);
    }

    public function test_owner_cannot_create_duplicate_unit_label(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );

        $payload = [
            'label' => 'Room 101',
            'unit_kind' => 'ROOM',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 3,
        ];

        $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units",
            ['client_operation_id' => (string) Str::uuid(), ...$payload],
        )->assertCreated();

        $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units",
            ['client_operation_id' => (string) Str::uuid(), ...$payload],
        )->assertUnprocessable()
            ->assertJsonValidationErrors('label');

        $this->assertDatabaseCount('units', 1);
    }

    public function test_owner_can_update_unit_and_change_operational_status(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS'
        );
        $unitId = (string) Str::uuid();

        DB::table('units')->insert([
            'id' => $unitId,
            'property_id' => $propertyId,
            'client_operation_id' => (string) Str::uuid(),
            'label' => 'Room 101',
            'unit_kind' => 'ROOM',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 3,
        ]);

        $this->actingAs($owner)
            ->patchJson("/api/v1/owner/properties/{$propertyId}/units/{$unitId}", [
                'expected_content_revision' => 1,
                'operational_status' => 'MAINTENANCE',
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $unitId)
            ->assertJsonPath('data.operational_status', 'MAINTENANCE');

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'unit',
            'entity_id' => $unitId,
            'action' => 'unit.updated',
        ]);
    }

    public function test_stale_unit_update_returns_conflict_without_overwriting_date(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );
        $unitId = (string) Str::uuid();

        DB::table('units')->insert([
            'id' => $unitId,
            'property_id' => $propertyId,
            'client_operation_id' => (string) Str::uuid(),
            'label' => 'Room 101',
            'unit_kind' => 'ROOM',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 3,
        ]);

        $this->actingAs($owner)
            ->patchJson("/api/v1/owner/properties/{$propertyId}/units/{$unitId}", [
                'expected_content_revision' => 1,
                'operational_status' => 'MAINTENANCE',
            ])
            ->assertOk();

        $this->actingAs($owner)
            ->patchJson("/api/v1/owner/properties/{$propertyId}/units/{$unitId}", [
                'expected_content_revision' => 1,
                'operational_status' => 'RETIRED',
            ])
            ->assertConflict();

        $this->assertDatabaseHas('units', [
            'id' => $unitId,
            'operational_status' => 'MAINTENANCE',
        ]);
    }

    public function test_foreign_owner_cannot_update_unit(): void
    {
        $owner = User::factory()->create();
        $otherOwner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );
        $unitId = (string) Str::uuid();

        DB::table('units')->insert([
            'id' => $unitId,
            'property_id' => $propertyId,
            'client_operation_id' => (string) Str::uuid(),
            'label' => 'Room 101',
            'unit_kind' => 'ROOM',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 3,
        ]);

        $this->actingAs($otherOwner)
            ->patchJson("/api/v1/owner/properties/{$propertyId}/units/{$unitId}", [
                'expected_content_revision' => 1,
                'operational_status' => 'MAINTENANCE',
            ])
            ->assertForbidden();

        $this->assertDatabaseHas('units', [
            'id' => $unitId,
            'operational_status' => 'READY',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validBatchUnit(string $label): array
    {
        return [
            'client_operation_id' => (string) Str::uuid(),
            'label' => $label,
            'unit_kind' => 'STUDIO',
            'bedrooms' => 1,
            'bathrooms' => 1,
            'bathroom_arrangement' => 'PRIVATE',
            'minimum_rental_months' => 3,
        ];
    }

    public function test_owner_can_create_and_replay_a_unit_batch(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );

        $payload = [
            'expected_content_revision' => 1,
            'client_operation_id' => (string) Str::uuid(),
            'units' => [
                $this->validBatchUnit('Studio 201'),
                $this->validBatchUnit('Studio 202'),
            ],
        ];

        $first = $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units/bulk",
            $payload,
        );

        $first->assertCreated()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.label', 'Studio 201')
            ->assertJsonPath('data.1.label', 'Studio 202');

        $this->assertDatabaseCount('units', 2);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);
        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseHas('idempotency_records', [
            'actor_id' => $owner->id,
            'action' => 'unit.bulk.create',
            'client_operation_id' => $payload['client_operation_id'],
        ]);

        $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units/bulk",
            $payload,
        )->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertDatabaseCount('units', 2);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);
    }

    public function test_duplicate_normalized_labels_reject_entire_unit_batch(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );

        $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units/bulk",
            [
                'expected_content_revision' => 1,
                'client_operation_id' => (string) Str::uuid(),
                'units' => [
                    $this->validBatchUnit('Studio 201'),
                    $this->validBatchUnit(' studio 201 '),
                ],
            ],
        )->assertUnprocessable()
            ->assertJsonValidationErrors('units.1.label');

        $this->assertDatabaseCount('units', 0);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 1,
        ]);
    }

    public function test_stale_revision_rejects_unit_batch_without_creating_rows(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty(
            $owner->id,
            rentalArrangement: 'SEPARATE_UNITS',
        );

        $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units/bulk",
            [
                'expected_content_revision' => 99,
                'client_operation_id' => (string) Str::uuid(),
                'units' => [
                    $this->validBatchUnit('Studio 201'),
                ],
            ],
        )->assertConflict();

        $this->assertDatabaseCount('units', 0);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 1,
        ]);
    }

    private function fakeSupabaseStorage(): void
    {
        config([
            'services.supabase.url' => 'http://127.0.0.1:54321',
            'services.supabase.service_role_key' => 'test-service-role-key',
            'services.supabase.storage.bucket' => 'property-media',
        ]);

        Http::fake(fn () => Http::response([], 200));
    }

    public function test_owner_can_upload_a_property_photo_to_storage(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);

        $this->fakeSupabaseStorage();

        $response = $this->actingAs($owner)->post(
            "/api/v1/owner/properties/{$propertyId}/media",
            [
                'client_operation_id' => (string) Str::uuid(),
                'expected_content_revision' => 1,
                'caption' => 'Living room',
                'photo' => UploadedFile::fake()->image('living-room.jpg'),
            ],
        );

        $response->assertCreated()
            ->assertJsonPath('data.property_id', $propertyId)
            ->assertJsonPath('data.caption', 'Living room')
            ->assertJsonPath('data.mime_type', 'image/jpeg');

        $mediaId = $response->json('data.id');

        $this->assertDatabaseHas('property_media', [
            'id' => $mediaId,
            'property_id' => $propertyId,
            'uploaded_by' => $owner->id,
            'caption' => 'Living room',
        ]);

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'property_media',
            'entity_id' => $mediaId,
            'action' => 'property_media.uploaded',
        ]);

        Http::assertSent(fn ($request): bool => str_contains(
            $request->url(),
            '/storage/v1/object/property-media/',
        ));
    }

    public function test_invalid_image_bytes_do_not_create_media(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);

        $this->fakeSupabaseStorage();

        $this->actingAs($owner)->post(
            "/api/v1/owner/properties/{$propertyId}/media",
            [
                'client_operation_id' => (string) Str::uuid(),
                'expected_content_revision' => 1,
                'photo' => UploadedFile::fake()->createWithContent(
                    'not-an-image.jpg',
                    'this is not image data',
                ),
            ],
        )->assertUnprocessable();

        $this->assertDatabaseCount('property_media', 0);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 1,
        ]);

        Http::assertNothingSent();
    }

    public function test_upload_retry_with_same_operation_id_returns_existing_media(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $operationId = (string) Str::uuid();
        $photo = UploadedFile::fake()->image('living-room.jpg');

        $this->fakeSupabaseStorage();

        $payload = [
            'client_operation_id' => $operationId,
            'expected_content_revision' => 1,
            'caption' => 'Living room',
            'photo' => $photo,
        ];

        $first = $this->actingAs($owner)->post(
            "/api/v1/owner/properties/{$propertyId}/media",
            $payload,
        );

        $first->assertCreated();
        $mediaId = $first->json('data.id');

        $retry = $this->actingAs($owner)->post(
            "/api/v1/owner/properties/{$propertyId}/media",
            $payload,
        );

        $retry->assertOk()->assertJsonPath('data.id', $mediaId);

        $this->assertDatabaseCount('property_media', 1);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);
    }

    public function test_owner_can_remove_a_photo_without_deleting_its_storage_object(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $mediaId = $this->createMedia($owner->id, $propertyId, 0);

        $response = $this->actingAs($owner)->deleteJson("/api/v1/owner/properties/{$propertyId}/media/{$mediaId}", [
            'expected_content_revision' => 1,
            'revision' => 1,
        ]);
        $response->assertOk()->assertJsonPath('data.id', $mediaId)->assertJsonMissingPath('data.storage_path');

        $this->assertSoftDeleted('property_media', ['id' => $mediaId]);
        $this->assertDatabaseHas('property_media', [
            'id' => $mediaId,
            'is_selected_for_listing' => false,
            'revision' => 2,
            'storage_path' => "properties/{$propertyId}/media/{$mediaId}.jpg",
        ]);
        $this->assertDatabaseHas('properties', ['id' => $propertyId, 'content_revision' => 2]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'property_media',
            'entity_id' => $mediaId,
            'action' => 'property_media.removed',
        ]);
    }

    public function test_owner_can_reorder_and_deselect_shared_gallery_photos(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $firstMediaId = $this->createMedia($owner->id, $propertyId, 0);
        $secondMediaId = $this->createMedia($owner->id, $propertyId, 1);

        $response = $this->actingAs($owner)->putJson(
            "/api/v1/owner/properties/{$propertyId}/gallery",
            [
                'expected_content_revision' => 1,
                'items' => [
                    [
                        'media_id' => $firstMediaId,
                        'revision' => 1,
                        'sort_order' => 1,
                        'is_selected_for_listing' => true,
                    ],
                    [
                        'media_id' => $secondMediaId,
                        'revision' => 1,
                        'sort_order' => 0,
                        'is_selected_for_listing' => false,
                    ],
                ],
            ],
        );

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $secondMediaId)
            ->assertJsonPath('data.0.is_selected_for_listing', false)
            ->assertJsonPath('data.0.revision', 2)
            ->assertJsonPath('data.1.id', $firstMediaId)
            ->assertJsonPath('data.1.sort_order', 1)
            ->assertJsonPath('data.1.revision', 2)
            ->assertJsonPath('meta.content_revision', 2);

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'property_media',
            'entity_id' => $secondMediaId,
            'action' => 'property_media.gallery_updated',
        ]);
    }

    public function test_owner_can_list_property_photos_without_exposing_storage_paths(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $firstMediaId = $this->createMedia($owner->id, $propertyId, 1);
        $secondMediaId = $this->createMedia($owner->id, $propertyId, 0);
        Http::fake(fn () => Http::response([], 200));

        $this->actingAs($owner)
            ->getJson("/api/v1/owner/properties/{$propertyId}/media")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $secondMediaId)
            ->assertJsonPath('data.0.revision', 1)
            ->assertJsonPath('data.1.id', $firstMediaId)
            ->assertJsonMissingPath('data.0.storage_path');
    }

    public function test_stale_media_revision_cannot_overwrite_gallery_state(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $mediaId = $this->createMedia($owner->id, $propertyId, 0);

        $this->actingAs($owner)->putJson(
            "/api/v1/owner/properties/{$propertyId}/gallery",
            [
                'expected_content_revision' => 1,
                'items' => [[
                    'media_id' => $mediaId,
                    'revision' => 2,
                    'sort_order' => 3,
                    'is_selected_for_listing' => false,
                ]],
            ],
        )->assertConflict();

        $this->assertDatabaseHas('property_media', [
            'id' => $mediaId,
            'revision' => 1,
            'sort_order' => 0,
            'is_selected_for_listing' => true,
        ]);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 1,
        ]);
    }

    public function test_gallery_cannot_deselect_a_listing_cover(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner->id);
        $mediaId = $this->createMedia($owner->id, $propertyId, 0);

        DB::table('listings')->insert([
            'id' => (string) Str::uuid(),
            'property_id' => $propertyId,
            'client_operation_id' => (string) Str::uuid(),
            'title' => 'Listing title',
            'description' => 'Listing description',
            'cover_media_id' => $mediaId,
        ]);

        $this->actingAs($owner)->putJson(
            "/api/v1/owner/properties/{$propertyId}/gallery",
            [
                'expected_content_revision' => 1,
                'items' => [[
                    'media_id' => $mediaId,
                    'revision' => 1,
                    'sort_order' => 0,
                    'is_selected_for_listing' => false,
                ]],
            ],
        )->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        $this->assertDatabaseHas('property_media', [
            'id' => $mediaId,
            'is_selected_for_listing' => true,
            'revision' => 1,
        ]);
        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 1,
        ]);
    }

    public function test_owner_can_reorder_and_deselect_unit_gallery_photos(): void
    {
        $owner = User::factory()->create();
        $property = $this->actingAs($owner)->postJson('/api/v1/owner/properties', $this->validProperty())->assertCreated();
        $propertyId = $property->json('data.id');
        $unitId = $property->json('data.units.0.id');
        $mediaIds = [];

        foreach ([0, 1] as $sortOrder) {
            $mediaId = (string) Str::uuid();
            $mediaIds[] = $mediaId;
            DB::table('property_media')->insert([
                'id' => $mediaId,
                'property_id' => $propertyId,
                'unit_id' => $unitId,
                'uploaded_by' => $owner->id,
                'client_operation_id' => (string) Str::uuid(),
                'storage_path' => "properties/{$propertyId}/units/{$unitId}/{$mediaId}.jpg",
                'sha256' => str_repeat('a', 64),
                'mime_type' => 'image/jpeg',
                'size_bytes' => 100,
                'sort_order' => $sortOrder,
                'is_selected_for_listing' => true,
            ]);
        }

        $this->putJson("/api/v1/owner/properties/{$propertyId}/units/{$unitId}/gallery", [
            'expected_content_revision' => 1,
            'items' => [
                ['media_id' => $mediaIds[0], 'revision' => 1, 'sort_order' => 1, 'is_selected_for_listing' => true],
                ['media_id' => $mediaIds[1], 'revision' => 1, 'sort_order' => 0, 'is_selected_for_listing' => false],
            ],
        ])->assertOk()
            ->assertJsonPath('data.0.id', $mediaIds[1])
            ->assertJsonPath('data.0.is_selected_for_listing', false)
            ->assertJsonPath('data.1.id', $mediaIds[0])
            ->assertJsonPath('meta.content_revision', 2);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'property_media',
            'entity_id' => $mediaIds[1],
            'action' => 'property_media.gallery_updated',
        ]);
    }

    private function createMedia(string $ownerId, string $propertyId, int $sortOrder): string
    {
        $mediaId = (string) Str::uuid();

        DB::table('property_media')->insert([
            'id' => $mediaId,
            'property_id' => $propertyId,
            'uploaded_by' => $ownerId,
            'client_operation_id' => (string) Str::uuid(),
            'storage_path' => "properties/{$propertyId}/media/{$mediaId}.jpg",
            'caption' => 'Test photo',
            'sort_order' => $sortOrder,
            'is_selected_for_listing' => true,
            'sha256' => str_repeat('a', 64),
            'mime_type' => 'image/jpeg',
            'size_bytes' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $mediaId;
    }
}
