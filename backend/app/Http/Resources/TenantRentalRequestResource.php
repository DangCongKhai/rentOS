<?php

namespace App\Http\Resources;

use App\Models\RentalRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin RentalRequest */
class TenantRentalRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->listing_title,
            'ward' => $this->ward,
            'city' => $this->city,
            'desired_move_in_date' => $this->desired_move_in_date,
            'desired_end_date' => $this->desired_end_date,
            'preferred_unit' => $this->unit_label,
            'status' => $this->status,
            'outcome_reason' => $this->outcome_reason,
            'updated_at' => $this->updated_at->format('Y-m-d\TH:i:s.uP'),
            'created_at' => $this->created_at->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'tenancy' => $this->tenancy_id === null ? null : [
                'id' => $this->tenancy_id,
                'status' => $this->tenancy_status,
                'confirmation_expires_at' => $this->confirmation_expires_at?->toIso8601String(),
            ],
        ];
    }
}
