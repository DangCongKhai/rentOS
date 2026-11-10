<?php

namespace App\Http\Resources;

use App\Models\RentalRequest;
use Illuminate\Http\Request;

/** @mixin RentalRequest */
class OwnerRentalRequestDetailResource extends OwnerRentalRequestResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'message' => $this->message,
            'updated_at' => $this->updated_at->format('Y-m-d\TH:i:s.uP'),
            'preferred_unit_available' => $this->preferred_unit_available,
            'alternative_units' => $this->alternative_units,
        ];
    }
}
