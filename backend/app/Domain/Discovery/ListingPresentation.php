<?php

namespace App\Domain\Discovery;

use App\Actions\OwnerProperties\AmenityCatalog;
use App\Domain\Media\PublicStorageUrl;
use App\Http\Resources\PublicUnitResource;
use App\Models\Listing;
use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\Unit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ListingPresentation
{
    public function prepareDetail(Listing $model): void
    {
        $criteria = new ListingSearchCriteria(null, null, null, null, null, null, null, null, [], null, 1, 12);
        $units = $this->eligibleUnits([$model->property_id], $criteria)->get();
        $this->attachUnitPresentation($units, $model->property, null);

        $media = $this->selectedMedia($model->property_id);
        $model->setAttribute('public_gallery', $this->mediaPayload($media->whereNull('unit_id')));
        $sharedAmenities = $this->documentAsArray($model->property->shared_amenities);
        $model->setAttribute('public_shared_amenities', $this->amenityPayload($sharedAmenities['standard'] ?? []));
        $model->setAttribute('public_custom_amenities', $sharedAmenities['custom'] ?? []);
        $model->setAttribute('public_units', $units);
        $model->setAttribute('search_summary', $this->summary($units, null, $model));
    }

    /** @return array<string, mixed> */
    private function documentAsArray(mixed $document): array
    {
        if (is_array($document)) {
            return $document;
        }

        if (is_object($document)) {
            return json_decode(json_encode($document, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
        }

        return [];
    }

    /**
     * @param  list<string>  $listingIds
     * @return Collection<int, Listing>
     */
    public function cardsFor(array $listingIds, ListingSearchCriteria $criteria, bool $requireFree = true): Collection
    {
        if ($listingIds === []) {
            return collect();
        }

        $listings = Listing::query()
            ->publiclyVisible()
            ->with(['property', 'coverMedia'])
            ->whereIn('id', $listingIds)
            ->get()
            ->keyBy(fn (Listing $listing): string => (string) $listing->id);

        $propertyIds = $listings->pluck('property_id')->map(fn (mixed $id): string => (string) $id)->all();
        $units = $this->eligibleUnits($propertyIds, $criteria, $requireFree)->get()->groupBy(
            fn (Unit $unit): string => (string) $unit->property_id,
        );
        $photos = PropertyMedia::query()
            ->whereIn('property_id', $propertyIds)
            ->where('is_selected_for_listing', true)
            ->whereNull('deleted_at')
            ->whereNull('purged_at')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->groupBy(fn (PropertyMedia $item): string => (string) $item->property_id);

        return collect($listingIds)
            ->map(function (string $id) use ($listings, $units, $photos, $criteria): ?Listing {
                $listing = $listings->get($id);
                if ($listing === null) {
                    return null;
                }
                $listingUnits = $units->get((string) $listing->property_id, collect())->values();
                $this->attachUnitPresentation($listingUnits, $listing->property, $criteria->moveInDate);
                $listing->setAttribute('search_summary', $this->summary(
                    $listingUnits,
                    $criteria->moveInDate,
                    $listing,
                    $photos->get((string) $listing->property_id, collect()),
                ));

                return $listing;
            })->filter()
            ->values();
    }

    /**
     * @param  list<string>  $propertyIds
     * @return Builder<Unit>
     */
    private function eligibleUnits(array $propertyIds, ListingSearchCriteria $criteria, bool $requireFree = false): Builder
    {
        $query = Unit::query()->select('units.*')->whereIn('units.property_id', $propertyIds);
        EligibleUnitQuery::constrain($query, $criteria, $requireFree);

        return $query;
    }

    /**
     * @param  Collection<int, Unit>  $units
     */
    private function attachUnitPresentation(Collection $units, Property $property, ?string $moveInDate): void
    {
        $today = CarbonImmutable::today()->toDateString();
        $blocks = DB::table('tenancies')
            ->whereIn('unit_id', $units->pluck('id'))
            ->whereIn('status', ['PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE'])
            ->whereNotNull('blocked_start_date')
            ->whereNotNull('blocked_end_date')
            ->get(['unit_id', 'blocked_start_date', 'blocked_end_date'])
            ->groupBy(fn (object $row): string => (string) $row->unit_id);

        $selected = $this->selectedMedia((string) $property->id);
        $media = $selected->groupBy(
            fn (PropertyMedia $item): string => (string) $item->unit_id,
        );

        foreach ($units as $unit) {
            $unitBlocks = collect($blocks->get((string) $unit->id, collect()))
                ->map(fn (object $row): array => [
                    'start' => (string) $row->blocked_start_date,
                    'end' => (string) $row->blocked_end_date,
                ])
                ->all();
            $described = UnitAvailability::describe($today, $unitBlocks);
            $held = $this->blockCovering($unitBlocks, $today);
            if (! $described['available_now']) {
                $described['label'] = 'Đã được giữ/đặt. '.$described['label'];
            }
            $described['held_start'] = $held['start'] ?? null;
            $described['held_end'] = $held['end'] ?? null;
            $described['free_for_move_in'] = $moveInDate === null
                ? $described['available_now']
                : UnitAvailability::stayIsFree($moveInDate, (int) $unit->minimum_rental_months, $unitBlocks);

            $amenities = $this->documentAsArray($unit->amenities);
            $policyOverrides = $this->documentAsArray($unit->policy_overrides);
            $standard = $amenities['standard'] ?? [];
            $propertyPolicies = $this->documentAsArray($property->policies);
            $unitRules = $policyOverrides['additional_rules'] ?? [];
            $sharedRules = $propertyPolicies['shared_rules'] ?? [];
            $unit->setAttribute('public_availability', $described);
            $unit->setAttribute('effective_pets', $policyOverrides['pets'] ?? $propertyPolicies['pets'] ?? null);
            $unit->setAttribute('effective_smoking', $policyOverrides['smoking'] ?? $propertyPolicies['smoking'] ?? null);
            $unit->setAttribute('effective_rules', array_values(array_unique([
                ...(is_array($sharedRules) ? $sharedRules : []),
                ...(is_array($unitRules) ? $unitRules : []),
            ])));
            $unit->setAttribute('public_amenities', $this->amenityPayload(is_array($standard) ? $standard : []));
            $unit->setAttribute('public_custom_amenities', $amenities['custom'] ?? []);
            $unit->setAttribute('public_photos', $this->mediaPayload(
                $media->get((string) $unit->id, collect())->unique('id')->values(),
            ));
        }
    }

    /**
     * @param  Collection<int, Unit>  $units
     * @param  Collection<int, PropertyMedia>  $photos
     * @return array{availability_label: string, available_unit_count: int, rent_min: string, rent_max: string, minimum_rental_months: int, cover_url: ?string, image_urls: list<string>}
     */
    private function summary(Collection $units, ?string $moveInDate, Listing $listing, ?Collection $photos = null): array
    {
        $free = $units->filter(function (Unit $unit) use ($moveInDate): bool {
            /** @var array<string, mixed> $availability */
            $availability = $unit->getAttribute('public_availability');

            return $moveInDate === null
                ? (bool) $availability['available_now']
                : (bool) $availability['free_for_move_in'];
        });

        $rents = $units->map(fn (Unit $unit): int => (int) round((float) $unit->advertised_monthly_rent));
        $label = 'Còn trống';
        if ($free->isEmpty()) {
            $from = $units
                ->map(fn (Unit $unit): ?string => $unit->getAttribute('public_availability')['available_from'] ?? null)
                ->filter()
                ->sort()
                ->first();
            $label = $moveInDate !== null ? 'Không còn căn trống cho ngày đã chọn'
                : ($from === null ? 'Hiện chưa còn căn trống' : 'Trống từ '.CarbonImmutable::parse($from)->format('d/m/Y'));
        } else {
            $until = $free
                ->map(fn (Unit $unit): ?string => $unit->getAttribute('public_availability')['available_until'] ?? null)
                ->filter();
            if ($until->count() === $free->count()) {
                $label = 'Còn trống đến '.CarbonImmutable::parse((string) $until->sort()->first())->format('d/m/Y');
            }
        }

        $cover = $listing->relationLoaded('coverMedia') ? $listing->coverMedia : null;

        return [
            'availability_label' => $label,
            'available_unit_count' => $free->count(),
            'rent_min' => PublicUnitResource::money($rents->min()),
            'rent_max' => PublicUnitResource::money($rents->max()),
            'minimum_rental_months' => (int) $units->min('minimum_rental_months'),
            'cover_url' => $cover instanceof PropertyMedia
                ? $this->publicMediaUrl((string) $cover->storage_path)
                : null,
            'image_urls' => $this->imageUrls($listing, $photos ?? collect()),
        ];
    }

    /**
     * @param  Collection<int, PropertyMedia>  $photos
     * @return list<string>
     */
    private function imageUrls(Listing $listing, Collection $photos): array
    {
        $cover = $listing->relationLoaded('coverMedia') ? $listing->coverMedia : null;
        $urls = [];

        if ($cover instanceof PropertyMedia && $this->isVisibleMedia($cover)) {
            $urls[] = $this->publicMediaUrl((string) $cover->storage_path);
        }

        foreach ($photos as $photo) {
            if (! $photo instanceof PropertyMedia || ! $this->isVisibleMedia($photo)) {
                continue;
            }
            if ($cover instanceof PropertyMedia && (string) $photo->id === (string) $cover->id) {
                continue;
            }
            $urls[] = $this->publicMediaUrl((string) $photo->storage_path);
        }

        return array_values(array_unique($urls));
    }

    private function isVisibleMedia(PropertyMedia $media): bool
    {
        return $media->is_selected_for_listing
            && $media->deleted_at === null
            && $media->purged_at === null;
    }

    private function publicMediaUrl(string $path): string
    {
        return app(PublicStorageUrl::class)->forPath($path);
    }

    /**
     * @return Collection<int, PropertyMedia>
     */
    private function selectedMedia(string $propertyId): Collection
    {
        return PropertyMedia::query()
            ->where('property_id', $propertyId)
            ->where('is_selected_for_listing', true)
            ->whereNull('deleted_at')
            ->whereNull('purged_at')
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * @param  Collection<int, PropertyMedia>  $media
     * @return list<array{id: string, caption: ?string, sort_order: int, url: string}>
     */
    private function mediaPayload(Collection $media): array
    {
        return $media->map(fn (PropertyMedia $item): array => [
            'id' => (string) $item->id,
            'caption' => $item->caption,
            'sort_order' => (int) $item->sort_order,
            'url' => $this->publicMediaUrl((string) $item->storage_path),
        ])->values()->all();
    }

    /**
     * @param  array<string, mixed>  $standard
     * @return list<array{key: string, label_vi: string, details: ?string}>
     */
    private function amenityPayload(array $standard): array
    {
        $items = [];
        foreach ($standard as $key => $value) {
            if (! is_string($key) || ! is_array($value) || ($value['enabled'] ?? false) !== true) {
                continue;
            }
            $label = AmenityCatalog::labelFor($key);
            if ($label === null) {
                continue;
            }
            $items[] = [
                'key' => $key,
                'label_vi' => $label,
                'details' => isset($value['details']) ? (string) $value['details'] : null,
            ];
        }

        return $items;
    }

    /**
     * @param  list<array{start: string, end: string}>  $blocks
     * @return array{start: string, end: string}|null
     */
    private function blockCovering(array $blocks, string $today): ?array
    {
        foreach ($blocks as $block) {
            if ($block['start'] <= $today && $block['end'] >= $today) {
                return $block;
            }
        }

        return null;
    }
}
