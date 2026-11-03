<?php

namespace App\Actions\Listings;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class ReadListingReviewPackage
{
    public function handle(string $listingId): array
    {
        return DB::transaction(fn (): array => $this->locked($listingId));
    }

    /**
     * Lock the parent before every child, including unselected/unmarketed rows.
     * The parent lock also blocks new children through their foreign keys.
     * The caller must keep a transaction open while using this result.
     */
    public function locked(string $listingId): array
    {
        $propertyId = DB::table('listings')->where('id', $listingId)->value('property_id');
        abort_if($propertyId === null, 404);
        $property = DB::table('properties')->where('id', $propertyId)->lockForUpdate()->first();
        $listing = DB::table('listings')->where('id', $listingId)->where('property_id', $propertyId)->lockForUpdate()->first();
        abort_if($property === null || $listing === null || $property->archived_at !== null || $listing->archived_at !== null, 404);

        $allUnits = DB::table('units')->where('property_id', $propertyId)->orderBy('id')->lockForUpdate()->get();
        $allMedia = DB::table('property_media')->where('property_id', $propertyId)->orderBy('id')->lockForUpdate()->get();
        $units = $allUnits->filter(fn (object $unit): bool => $unit->is_marketed && $unit->archived_at === null)->values();
        $unitIds = $units->pluck('id')->all();
        $media = $allMedia->filter(fn (object $photo): bool => $photo->is_selected_for_listing && $photo->deleted_at === null && $photo->purged_at === null && ($photo->unit_id === null || in_array($photo->unit_id, $unitIds, true)))->sortBy([['sort_order', 'asc'], ['id', 'asc']])->values();

        $listingData = Arr::only((array) $listing, ['id', 'title', 'description', 'moderation_status', 'publication_status', 'submitted_at', 'submitted_revision', 'submitted_content_revision', 'approved_content_revision', 'reviewed_at', 'review_reason', 'cover_media_id']);
        $propertyData = Arr::only((array) $property, ['id', 'name', 'property_type', 'rental_arrangement', 'address_line', 'ward', 'city', 'description', 'content_revision', 'shared_amenities', 'policies', 'latitude', 'longitude', 'archived_at']);
        foreach (['shared_amenities', 'policies'] as $field) {
            $propertyData[$field] = json_decode($propertyData[$field], true, flags: JSON_THROW_ON_ERROR);
        }
        $unitData = $units->map(function (object $unit): array {
            $data = Arr::only((array) $unit, ['id', 'label', 'unit_kind', 'description', 'floor', 'area_m2', 'bedrooms', 'bathrooms', 'bathroom_arrangement', 'amenities', 'advertised_monthly_rent', 'deposit', 'minimum_rental_months', 'max_occupants', 'operational_status', 'policy_overrides']);
            foreach (['amenities', 'policy_overrides'] as $field) {
                $data[$field] = json_decode($data[$field], true, flags: JSON_THROW_ON_ERROR);
            }

            return $data;
        })->all();
        $fingerprintMedia = $media->map(fn (object $photo): array => Arr::only((array) $photo, ['id', 'unit_id', 'caption', 'sort_order', 'mime_type', 'size_bytes', 'sha256', 'storage_path']))->all();
        $snapshot = hash('sha256', json_encode([$listingData, $propertyData, $unitData, $fingerprintMedia, $property->owner_id, $listing->reviewed_by, $listing->admin_suspended_at], JSON_THROW_ON_ERROR));
        $owner = DB::table('users')->where('id', $property->owner_id)->first(['id', 'name', 'email']);
        $reviewer = $listing->reviewed_by ? DB::table('users')->where('id', $listing->reviewed_by)->first(['id', 'name']) : null;

        return $listingData + [
            'snapshot_token' => $snapshot,
            'property' => $propertyData,
            'owner' => (array) $owner + ['other_listings_count' => DB::table('listings')->join('properties', 'properties.id', '=', 'listings.property_id')->where('properties.owner_id', $property->owner_id)->where('listings.id', '<>', $listingId)->whereNull('listings.archived_at')->count()],
            'reviewer' => $reviewer ? (array) $reviewer : null,
            'units' => $unitData,
            'media' => $media->map(fn (object $photo): array => Arr::only((array) $photo, ['id', 'unit_id', 'caption', 'sort_order', 'mime_type', 'size_bytes']) + ['url' => route('api.v1.admin.listing-reviews.media', ['listing' => $listingId, 'media' => $photo->id], false)])->all(),
            'audit' => DB::table('audit_logs as audit')->leftJoin('users as actors', 'actors.id', '=', 'audit.actor_id')->where('audit.entity_type', 'listing')->where('audit.entity_id', $listingId)->orderByDesc('audit.created_at')->orderByDesc('audit.id')->limit(50)->get(['audit.id', 'audit.action', 'actors.name as actor_name', 'audit.reason', 'audit.created_at'])->map(fn (object $row): array => (array) $row)->all(),
            'completeness' => $this->completeness($propertyData, $listingData, $unitData, $media->all()),
        ];
    }

    private function completeness(array $property, array $listing, array $units, array $media): array
    {
        $address = collect(['address_line', 'ward', 'city', 'description'])->every(fn (string $field): bool => filled($property[$field]));
        $cover = collect($media)->contains(fn (object $photo): bool => $photo->id === $listing['cover_media_id'] && $photo->unit_id === null);
        $unitTerms = count($units) > 0 && collect($units)->every(fn (array $unit): bool => $unit['operational_status'] === 'READY' && $unit['area_m2'] !== null && $unit['advertised_monthly_rent'] !== null && $unit['deposit'] !== null && $unit['minimum_rental_months'] !== null && $unit['max_occupants'] !== null && collect($media)->contains(fn (object $photo): bool => $photo->unit_id === $unit['id']));
        $policies = filled($property['policies']['pets'] ?? null) && filled($property['policies']['smoking'] ?? null);

        return ['address' => $address, 'shared_cover' => $cover, 'unit_photos_terms' => $unitTerms, 'policies' => $policies, 'complete' => $address && $cover && $unitTerms && $policies];
    }
}
