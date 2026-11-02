<?php

namespace App\Http\Resources;

use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

/**
 * @mixin Unit
 */
class PublicUnitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $availability */
        $availability = $this->resource->getAttribute('public_availability');
        /** @var Collection<int, array<string, mixed>> $photos */
        $photos = $this->resource->getAttribute('public_photos');

        return [
            'id' => $this->id,
            'label' => $this->label,
            'unit_kind' => $this->unit_kind,
            'description' => $this->description,
            'area_m2' => $this->area_m2,
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'advertised_monthly_rent' => self::money($this->advertised_monthly_rent),
            'deposit' => self::money($this->deposit),
            'minimum_rental_months' => $this->minimum_rental_months,
            'max_occupants' => $this->max_occupants,
            'availability_label' => $availability['label'],
            'available_from' => $availability['available_from'],
            'available_until' => $availability['available_until'],
            'held_start' => $availability['held_start'],
            'held_end' => $availability['held_end'],
            'pets' => $this->resource->getAttribute('effective_pets'),
            'amenities' => $this->resource->getAttribute('public_amenities'),
            'custom_amenities' => $this->resource->getAttribute('public_custom_amenities'),
            'photos' => $photos,
        ];
    }

    public static function money(mixed $amount): string
    {
        return (string) (int) round((float) $amount);
    }
}
