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
        /**
         * @var object{
         *     id: string,
         *     actor_id: string|null,
         *     audience: string,
         *     title: string,
         *     body: string,
         *     resource_type: string|null,
         *     resource_id: string|null,
         *     read_at: string|null,
         *     created_at: string
         * } $notification
         */
        $notification = $this->resource;

        return [
            'id' => $notification->id,
            'actor_id' => $notification->actor_id,
            'audience' => $notification->audience,
            'title' => $notification->title,
            'body' => $notification->body,
            'resource_type' => $notification->resource_type,
            'resource_id' => $notification->resource_id,
            'read_at' => $notification->read_at,
            'created_at' => $notification->created_at,
        ];
    }
}
