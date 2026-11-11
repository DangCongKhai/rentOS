<?php

namespace App\Http\Resources;

use App\Models\RentalRequest;
use Illuminate\Http\Request;

/** @mixin RentalRequest */
class TenantRentalRequestDetailResource extends TenantRentalRequestResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'contact_name' => $this->contact_name,
            'contact_phone' => $this->contact_phone,
            'message' => $this->message,
        ];
    }
}
