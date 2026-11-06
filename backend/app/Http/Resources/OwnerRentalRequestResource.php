<?php

namespace App\Http\Resources;

use App\Models\RentalRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin RentalRequest */
class OwnerRentalRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'contact_name' => $this->contact_name,
            'contact_phone' => $this->contact_phone,
            'title' => $this->listing_title,
            'desired_move_in_date' => $this->desired_move_in_date,
            'desired_end_date' => $this->desired_end_date,
            'preferred_unit' => $this->unit_label,
            'status' => $this->status,
            'outcome_reason' => $this->outcome_reason,
            'created_at' => $this->created_at->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
        ];
    }
}
