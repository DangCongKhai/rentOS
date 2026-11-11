<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class OwnerPropertyMetadataTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_load_the_canonical_amenity_catalog_using_an_explicit_alias(): void
    {
        $owner = User::factory()->create();

        $this->actingAs($owner)
            ->getJson('/api/v1/owner/amenities?q=AC')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.key', 'air_conditioning')
            ->assertJsonPath('data.0.label', 'Điều hòa');
    }

    public function test_owner_catalog_requires_an_owner_session(): void
    {
        $this->getJson('/api/v1/owner/amenities')->assertUnauthorized();

        $owner = User::factory()->create();
        $this->actingAs($owner)->getJson('/api/v1/owner/amenities')
            ->assertOk()
            ->assertJsonFragment(['key' => 'wifi', 'label' => 'Wi-Fi']);
    }

    public function test_contract_policy_snapshot_does_not_change_when_advertised_policies_are_edited(): void
    {
        $published = PublicListingFixture::published([
            'policies' => [
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => [],
            ],
        ]);
        PublicListingFixture::blockUnit($published->unitIds[0], '2026-11-01', '2027-02-01');
        $contractId = DB::table('tenancy_contracts')->value('id');
        $snapshot = DB::table('tenancy_contracts')->where('id', $contractId)->value('policies_snapshot');

        $this->actingAs($published->owner)->patchJson("/api/v1/owner/properties/{$published->propertyId}", [
            'expected_content_revision' => 1,
            'policies' => [
                'schema_version' => 1,
                'pets' => 'ALLOWED',
                'smoking' => 'ALLOWED',
                'shared_rules' => ['Quiet hours after 10 PM'],
            ],
        ])->assertOk();

        $this->actingAs($published->owner)->patchJson(
            "/api/v1/owner/properties/{$published->propertyId}/units/{$published->unitIds[0]}",
            [
                'expected_content_revision' => 2,
                'policy_overrides' => [
                    'smoking' => 'OUTDOOR_ONLY',
                    'additional_rules' => ['No shoes indoors'],
                ],
            ],
        )->assertOk()->assertJsonPath('data.policy_overrides.smoking', 'OUTDOOR_ONLY');

        $this->assertSame(
            $snapshot,
            DB::table('tenancy_contracts')->where('id', $contractId)->value('policies_snapshot'),
        );
    }

    public function test_property_policy_and_amenity_text_is_normalized_and_audited(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner, 'WHOLE_SPACE');

        $this->actingAs($owner)->putJson(
            "/api/v1/owner/properties/{$propertyId}",
            [
                'expected_content_revision' => 1,
                'shared_amenities' => [
                    'schema_version' => 1,
                    'standard' => [
                        'wifi' => ['enabled' => true, 'details' => '  Fast   Wi-Fi  '],
                    ],
                    'custom' => [
                        '  Máy   giặt  ',
                        "Ma\u{0301}y gia\u{0306}\u{0323}t",
                        'EV Charger',
                    ],
                ],
                'policies' => [
                    'schema_version' => 1,
                    'pets' => 'NOT_ALLOWED',
                    'smoking' => 'NOT_ALLOWED',
                    'shared_rules' => [' Quiet   hours after 10 PM '],
                ],
            ],
        )->assertOk()
            ->assertJsonPath('data.shared_amenities.standard.wifi.enabled', true)
            ->assertJsonPath('data.shared_amenities.standard.wifi.details', 'Fast Wi-Fi')
            ->assertJsonPath('data.shared_amenities.custom', ['Máy giặt', 'EV Charger'])
            ->assertJsonPath('data.policies.shared_rules', ['Quiet hours after 10 PM'])
            ->assertJsonPath('data.content_revision', 2);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'property',
            'entity_id' => $propertyId,
            'action' => 'property.updated',
        ]);
    }

    public function test_property_rejects_unknown_or_wrong_scope_amenities_and_markup_without_writing(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner, 'WHOLE_SPACE');

        $this->actingAs($owner)->putJson(
            "/api/v1/owner/properties/{$propertyId}",
            [
                'expected_content_revision' => 1,
                'shared_amenities' => [
                    'schema_version' => 1,
                    'standard' => [
                        'air_conditioning' => ['enabled' => true],
                        'wifi' => ['enabled' => true],
                    ],
                    'custom' => [],
                ],
                'policies' => [
                    'schema_version' => 1,
                    'pets' => 'NOT_ALLOWED',
                    'smoking' => 'NOT_ALLOWED',
                    'shared_rules' => ['<script>alert(1)</script>'],
                ],
            ],
        )->assertUnprocessable()
            ->assertJsonValidationErrors([
                'shared_amenities.standard.air_conditioning',
                'policies.shared_rules.0',
            ]);

        $this->actingAs($owner)->putJson(
            "/api/v1/owner/properties/{$propertyId}",
            [
                'expected_content_revision' => 1,
                'shared_amenities' => [
                    'schema_version' => 1,
                    'standard' => [
                        'wifi' => ['enabled' => true, 'owner_label' => 'My label'],
                    ],
                    'custom' => [],
                ],
            ],
        )->assertUnprocessable()
            ->assertJsonValidationErrors('shared_amenities.standard.wifi');

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 1,
        ]);
        $this->assertDatabaseMissing('audit_logs', [
            'entity_type' => 'property',
            'entity_id' => $propertyId,
            'action' => 'property.updated',
        ]);
    }

    public function test_unit_can_save_scoped_amenities_and_policy_overrides(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner, 'SEPARATE_UNITS');
        $unitId = $this->createUnit($owner, $propertyId);

        $this->actingAs($owner)->patchJson(
            "/api/v1/owner/properties/{$propertyId}/units/{$unitId}",
            [
                'expected_content_revision' => 2,
                'amenities' => [
                    'schema_version' => 1,
                    'standard' => [
                        'air_conditioning' => ['enabled' => true],
                    ],
                    'custom' => ['  Desk   and chair '],
                ],
                'policy_overrides' => [
                    'pets' => 'ASK_OWNER',
                    'additional_rules' => [' Quiet   after 10 PM '],
                ],
            ],
        )->assertOk()
            ->assertJsonPath('data.amenities.standard.air_conditioning.enabled', true)
            ->assertJsonPath('data.amenities.custom', ['Desk and chair'])
            ->assertJsonPath('data.policy_overrides.pets', 'ASK_OWNER')
            ->assertJsonPath('data.policy_overrides.additional_rules', ['Quiet after 10 PM']);
    }

    public function test_unit_cannot_inject_policy_keys_or_use_shared_amenity_scope(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner, 'SEPARATE_UNITS');
        $unitId = $this->createUnit($owner, $propertyId);

        $this->actingAs($owner)->patchJson(
            "/api/v1/owner/properties/{$propertyId}/units/{$unitId}",
            [
                'expected_content_revision' => 2,
                'amenities' => [
                    'schema_version' => 1,
                    'standard' => [
                        'elevator' => ['enabled' => true],
                    ],
                    'custom' => [],
                ],
            ],
        )->assertUnprocessable()
            ->assertJsonValidationErrors('amenities.standard.elevator');

        $this->actingAs($owner)->patchJson(
            "/api/v1/owner/properties/{$propertyId}/units/{$unitId}",
            [
                'expected_content_revision' => 2,
                'policy_overrides' => [
                    'shared_rules' => ['Remove building rules'],
                    'admin_flag' => 'true',
                ],
            ],
        )->assertUnprocessable()
            ->assertJsonValidationErrors('policy_overrides');

        $this->assertDatabaseHas('properties', [
            'id' => $propertyId,
            'content_revision' => 2,
        ]);
    }

    public function test_bulk_unit_metadata_uses_the_same_canonical_validation_and_normalization(): void
    {
        $owner = User::factory()->create();
        $propertyId = $this->createProperty($owner, 'SEPARATE_UNITS');

        $this->actingAs($owner)->postJson(
            "/api/v1/owner/properties/{$propertyId}/units/bulk",
            [
                'expected_content_revision' => 1,
                'client_operation_id' => (string) Str::uuid(),
                'units' => [[
                    'client_operation_id' => (string) Str::uuid(),
                    'label' => 'Room 201',
                    'unit_kind' => 'ROOM',
                    'bedrooms' => 1,
                    'bathrooms' => 1,
                    'bathroom_arrangement' => 'PRIVATE',
                    'minimum_rental_months' => 3,
                    'amenities' => [
                        'schema_version' => 1,
                        'standard' => [
                            'air_conditioning' => ['enabled' => true],
                        ],
                        'custom' => ['  Desk   and chair '],
                    ],
                    'policy_overrides' => [
                        'pets' => 'ASK_OWNER',
                        'additional_rules' => [' Quiet   after 10 PM '],
                    ],
                ]],
            ],
        )->assertCreated()
            ->assertJsonPath('data.0.amenities.standard.air_conditioning.enabled', true)
            ->assertJsonPath('data.0.amenities.custom', ['Desk and chair'])
            ->assertJsonPath('data.0.policy_overrides.pets', 'ASK_OWNER')
            ->assertJsonPath('data.0.policy_overrides.additional_rules', ['Quiet after 10 PM']);
    }

    private function createProperty(User $owner, string $arrangement): string
    {
        $response = $this->actingAs($owner)->postJson('/api/v1/owner/properties', [
            'client_operation_id' => (string) Str::uuid(),
            'name' => 'Metadata test property',
            'property_type' => 'APARTMENT',
            'rental_arrangement' => $arrangement,
        ]);

        $response->assertCreated();

        return $response->json('data.id');
    }

    private function createUnit(User $owner, string $propertyId): string
    {
        $response = $this->actingAs($owner)->postJson(
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
        );

        $response->assertCreated();

        return $response->json('data.id');
    }
}
