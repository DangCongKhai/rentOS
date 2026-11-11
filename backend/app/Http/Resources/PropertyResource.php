<?php

namespace App\Http\Resources;

use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Property
 */
class PropertyResource extends JsonResource
{
    public function withResponse(Request $request, JsonResponse $response): void
    {
        $response->headers->set('Cache-Control', 'private, no-store');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'owner_id' => $this->owner_id,
            'name' => $this->name,
            'property_type' => $this->property_type,
            'rental_arrangement' => $this->rental_arrangement,
            'address_line' => $this->address_line,
            'ward' => $this->ward,
            'city' => $this->city,
            'description' => $this->description,
            'shared_amenities' => $this->shared_amenities,
            'policies' => $this->policies,
            'content_revision' => $this->content_revision,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'archived_at' => $this->archived_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'units' => UnitResource::collection($this->whenLoaded('units')),
        ];
    }
}
