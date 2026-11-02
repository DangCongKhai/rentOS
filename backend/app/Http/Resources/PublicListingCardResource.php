<?php

namespace App\Http\Resources;

use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Listing
 */
class PublicListingCardResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $summary */
        $summary = $this->resource->getAttribute('search_summary');
        $property = $this->property;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'availability_label' => $summary['availability_label'],
            'available_unit_count' => $summary['available_unit_count'],
            'rent_min' => $summary['rent_min'],
            'rent_max' => $summary['rent_max'],
            'minimum_rental_months' => $summary['minimum_rental_months'],
            'cover_url' => $summary['cover_url'],
            'image_urls' => $summary['image_urls'],
            'property' => [
                'name' => $property->name,
                'property_type' => $property->property_type,
                'ward' => $property->ward,
                'city' => $property->city,
            ],
        ];
    }
}
