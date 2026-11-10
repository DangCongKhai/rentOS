<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'audience' => $this->audience,
            'title' => $this->title,
            'body' => $this->body,
            'resource_type' => $this->resource_type,
            'resource_id' => $this->resource_id,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
        ];
    }
}
