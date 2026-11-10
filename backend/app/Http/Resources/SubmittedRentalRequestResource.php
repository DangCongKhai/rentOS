<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubmittedRentalRequestResource extends JsonResource
{
    /** @return array{id: string, status: string} */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource['id'],
            'status' => $this->resource['status'],
        ];
    }
}
