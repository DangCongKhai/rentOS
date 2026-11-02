<?php

namespace App\Http\Resources;

use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Listing
 */
class PublicListingDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $property = $this->property;
        /** @var array<string, mixed> $summary */
        $summary = $this->resource->getAttribute('search_summary');

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'availability_label' => $summary['availability_label'],
            'available_unit_count' => $summary['available_unit_count'],
            'gallery' => $this->resource->getAttribute('public_gallery'),
            'property' => [
                'name' => $property->name,
                'property_type' => $property->property_type,
                'address_line' => $property->address_line,
                'ward' => $property->ward,
                'city' => $property->city,
                'description' => $property->description,
                'shared_rules' => $property->policies['shared_rules'] ?? [],
                'shared_amenities' => $this->resource->getAttribute('public_shared_amenities'),
                'custom_amenities' => $property->shared_amenities['custom'] ?? [],
            ],
            'owner' => [
                'name' => $property->owner?->name,
            ],
            'units' => PublicUnitResource::collection($this->resource->getAttribute('public_units')),
        ];
    }
}
