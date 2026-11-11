<?php

namespace App\Http\Resources;

use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Unit
 */
class UnitResource extends JsonResource
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
            'property_id' => $this->property_id,
            'label' => $this->label,
            'unit_kind' => $this->unit_kind,
            'description' => $this->description,
            'floor' => $this->floor,
            'area_m2' => $this->area_m2,
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'bathroom_arrangement' => $this->bathroom_arrangement,
            'amenities' => $this->amenities,
            'advertised_monthly_rent' => $this->advertised_monthly_rent,
            'deposit' => $this->deposit,
            'minimum_rental_months' => $this->minimum_rental_months,
            'max_occupants' => $this->max_occupants,
            'operational_status' => $this->operational_status,
            'is_marketed' => $this->is_marketed,
            'policy_overrides' => $this->policy_overrides,
            'archived_at' => $this->archived_at,
        ];
    }
}
