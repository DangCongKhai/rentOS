<?php

namespace Tests\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PublishedListing
{
    /**
     * @param  list<string>  $unitIds
     */
    public function __construct(
        public string $listingId,
        public string $propertyId,
        public array $unitIds,
        public User $owner,
        public string $coverMediaId,
    ) {}
}

final class PublicListingFixture
{
    /**
     * @param  array<string, mixed>  $overrides
     */
    public static function published(array $overrides = []): PublishedListing
    {
        $owner = User::factory()->create();
        $now = now();
        $propertyId = (string) Str::uuid();
        $listingId = (string) Str::uuid();
        $coverMediaId = (string) Str::uuid();

        $publicationStatus = $overrides['publication_status'] ?? 'PUBLISHED';
        $moderationStatus = $overrides['moderation_status'] ?? ($publicationStatus === 'DRAFT' ? 'DRAFT' : 'APPROVED');
        $requiresApproval = $moderationStatus === 'APPROVED' || $publicationStatus === 'PUBLISHED';

        $policies = $overrides['policies'] ?? [
            'schema_version' => 1,
            'pets' => 'NOT_ALLOWED',
            'smoking' => 'NOT_ALLOWED',
            'shared_rules' => ['Không hút thuốc trong nhà'],
        ];
        $sharedAmenities = $overrides['shared_amenities'] ?? self::amenityDocument();

        DB::table('properties')->insert([
            'id' => $propertyId,
            'owner_id' => $owner->id,
            'client_operation_id' => (string) Str::uuid(),
            'name' => $overrides['name'] ?? 'Nhà Hải Châu',
            'property_type' => $overrides['property_type'] ?? 'APARTMENT',
            'rental_arrangement' => $overrides['rental_arrangement'] ?? 'SEPARATE_UNITS',
            'address_line' => $overrides['address_line'] ?? '12 Nguyễn Văn Linh',
            'ward' => $overrides['ward'] ?? 'Hải Châu',
            'city' => $overrides['city'] ?? 'Đà Nẵng',
            'description' => $overrides['description'] ?? 'Nhà cho thuê đầy đủ nội thất gần trung tâm.',
            'shared_amenities' => json_encode($sharedAmenities, JSON_THROW_ON_ERROR),
            'policies' => json_encode($policies, JSON_THROW_ON_ERROR),
            'content_revision' => 1,
            'archived_at' => $overrides['property_archived_at'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        /** @var list<array<string, mixed>> $unitOverrides */
        $unitOverrides = $overrides['units'] ?? [[]];
        $unitIds = [];
        foreach ($unitOverrides as $index => $unitOverride) {
            $unitId = (string) Str::uuid();
            $unitIds[] = $unitId;
            $isMarketed = $unitOverride['is_marketed'] ?? true;
            $amenities = $unitOverride['amenities'] ?? self::amenityDocument();
            $policyOverrides = $unitOverride['policy_overrides'] ?? new \stdClass;

            DB::table('units')->insert([
                'id' => $unitId,
                'property_id' => $propertyId,
                'client_operation_id' => (string) Str::uuid(),
                'label' => $unitOverride['label'] ?? 'Phòng '.($index + 1),
                'unit_kind' => $unitOverride['unit_kind'] ?? 'STUDIO',
                'description' => $unitOverride['description'] ?? 'Phòng đầy đủ nội thất',
                'floor' => $unitOverride['floor'] ?? '2',
                'area_m2' => $unitOverride['area_m2'] ?? 28,
                'bedrooms' => $unitOverride['bedrooms'] ?? 1,
                'bathrooms' => $unitOverride['bathrooms'] ?? 1,
                'bathroom_arrangement' => $unitOverride['bathroom_arrangement'] ?? 'PRIVATE',
                'amenities' => json_encode($amenities, JSON_THROW_ON_ERROR),
                'advertised_monthly_rent' => $unitOverride['advertised_monthly_rent'] ?? 3800000,
                'deposit' => $unitOverride['deposit'] ?? 3800000,
                'minimum_rental_months' => $unitOverride['minimum_rental_months'] ?? 3,
                'max_occupants' => $unitOverride['max_occupants'] ?? 2,
                'operational_status' => $unitOverride['operational_status'] ?? 'READY',
                'is_marketed' => $isMarketed,
                'policy_overrides' => json_encode($policyOverrides, JSON_THROW_ON_ERROR),
                'archived_at' => $unitOverride['archived_at'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if ($isMarketed) {
                self::insertMedia($propertyId, $unitId, $owner->id, $index + 1);
            }
        }

        self::insertMedia($propertyId, null, $owner->id, 0, $coverMediaId);

        $suspendedAt = $overrides['admin_suspended_at'] ?? null;

        DB::table('listings')->insert([
            'id' => $listingId,
            'property_id' => $propertyId,
            'client_operation_id' => (string) Str::uuid(),
            'title' => $overrides['title'] ?? 'Studio full nội thất gần biển Mỹ Khê',
            'description' => $overrides['listing_description'] ?? 'Tin đăng công khai cho phòng ở Hải Châu.',
            'cover_media_id' => $coverMediaId,
            'moderation_status' => $moderationStatus,
            'publication_status' => $publicationStatus,
            'submitted_revision' => $requiresApproval ? 1 : null,
            'submitted_at' => $requiresApproval ? $now : null,
            'reviewed_by' => $requiresApproval ? $owner->id : null,
            'reviewed_at' => $requiresApproval ? $now : null,
            'submitted_content_revision' => $requiresApproval ? 1 : null,
            'approved_content_revision' => $requiresApproval ? 1 : null,
            'archived_at' => $overrides['listing_archived_at'] ?? null,
            'admin_suspended_at' => $suspendedAt,
            'admin_suspended_by' => $suspendedAt ? $owner->id : null,
            'suspension_reason' => $suspendedAt ? ($overrides['suspension_reason'] ?? 'Tạm ngưng kiểm duyệt') : null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return new PublishedListing($listingId, $propertyId, $unitIds, $owner, $coverMediaId);
    }

    public static function blockUnit(string $unitId, string $start, string $end, string $status = 'PENDING_CONFIRMATION'): void
    {
        $unit = DB::table('units')->where('id', $unitId)->first();
        if ($unit === null) {
            throw new \RuntimeException('Unit not found.');
        }

        $property = DB::table('properties')->where('id', $unit->property_id)->first();
        $listing = DB::table('listings')->where('property_id', $unit->property_id)->whereNull('archived_at')->first();
        if ($property === null || $listing === null) {
            throw new \RuntimeException('Published listing for the unit was not found.');
        }

        $tenant = User::factory()->create();
        $now = now();
        $requestId = (string) Str::uuid();
        $tenancyId = (string) Str::uuid();
        $contractId = (string) Str::uuid();

        DB::table('rental_requests')->insert([
            'id' => $requestId,
            'listing_id' => $listing->id,
            'tenant_id' => $tenant->id,
            'preferred_unit_id' => $unitId,
            'client_operation_id' => (string) Str::uuid(),
            'desired_move_in_date' => $start,
            'desired_end_date' => $end,
            'message' => 'Tôi muốn thuê phòng này.',
            'contact_name' => 'Người thuê',
            'contact_phone' => '0901234567',
            'status' => 'ACCEPTED',
            'closed_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('tenancies')->insert([
            'id' => $tenancyId,
            'unit_id' => $unitId,
            'tenant_id' => $tenant->id,
            'owner_id' => $property->owner_id,
            'rental_request_id' => $requestId,
            'client_operation_id' => (string) Str::uuid(),
            'status' => $status,
            'confirmed_start_date' => null,
            'confirmed_end_date' => null,
            'blocked_start_date' => $start,
            'blocked_end_date' => $end,
            'pending_contract_id' => $contractId,
            'latest_confirmed_contract_id' => null,
            'confirmation_expires_at' => $now->copy()->addDays(2),
            'moved_in_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('tenancy_contracts')->insert([
            'id' => $contractId,
            'tenancy_id' => $tenancyId,
            'version_number' => 1,
            'type' => 'ORIGINAL',
            'start_date' => $start,
            'end_date' => $end,
            'monthly_rent' => $unit->advertised_monthly_rent,
            'deposit_amount' => $unit->deposit,
            'policies_snapshot' => json_encode([
                'schema_version' => 1,
                'pets' => 'NOT_ALLOWED',
                'smoking' => 'NOT_ALLOWED',
                'shared_rules' => [],
            ], JSON_THROW_ON_ERROR),
            'document_path' => 'contracts/'.$contractId.'.pdf',
            'document_sha256' => hash('sha256', $contractId),
            'created_by' => $property->owner_id,
            'owner_confirmed_at' => $now,
            'tenant_confirmed_at' => null,
            'tenant_rejected_at' => null,
            'created_at' => $now,
        ]);
    }

    /**
     * @param  array<string, array{enabled: bool, details?: string}>  $standard
     * @param  list<string>  $custom
     * @return array{schema_version: int, standard: object, custom: list<string>}
     */
    public static function amenityDocument(array $standard = [], array $custom = []): array
    {
        return [
            'schema_version' => 1,
            'standard' => (object) $standard,
            'custom' => $custom,
        ];
    }

    private static function insertMedia(string $propertyId, ?string $unitId, string $ownerId, int $sortOrder, ?string $id = null): string
    {
        $mediaId = $id ?? (string) Str::uuid();
        $now = now();

        DB::table('property_media')->insert([
            'id' => $mediaId,
            'property_id' => $propertyId,
            'unit_id' => $unitId,
            'uploaded_by' => $ownerId,
            'client_operation_id' => (string) Str::uuid(),
            'storage_path' => 'listings/'.$mediaId.'.jpg',
            'caption' => $unitId === null ? 'Ảnh bìa' : 'Ảnh phòng',
            'sort_order' => $sortOrder,
            'is_selected_for_listing' => true,
            'sha256' => hash('sha256', $mediaId),
            'mime_type' => 'image/jpeg',
            'size_bytes' => 12000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $mediaId;
    }
}
