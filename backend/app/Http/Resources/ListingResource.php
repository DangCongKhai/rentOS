<?php

namespace App\Http\Resources;

use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Listing */
class ListingResource extends JsonResource
{
    public function withResponse(Request $request, JsonResponse $response): void
    {
        $response->headers->set('Cache-Control', 'private, no-store');
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'property_id' => $this->property_id,
            'client_operation_id' => $this->client_operation_id,
            'title' => $this->title,
            'description' => $this->description,
            'cover_media_id' => $this->cover_media_id,
            'moderation_status' => $this->moderation_status,
            'publication_status' => $this->publication_status,
            'submitted_revision' => $this->submitted_revision,
            'submitted_content_revision' => $this->submitted_content_revision,
            'approved_content_revision' => $this->approved_content_revision,
            'submitted_at' => $this->submitted_at,
            'reviewed_at' => $this->reviewed_at,
            'review_reason' => $this->review_reason,
            'admin_suspended_at' => $this->admin_suspended_at,
            'archived_at' => $this->archived_at,
            'property_content_revision' => $this->whenLoaded('property', fn () => $this->property->content_revision),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
