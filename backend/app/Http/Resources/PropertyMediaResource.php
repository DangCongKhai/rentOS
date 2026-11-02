<?php

namespace App\Http\Resources;

use App\Models\PropertyMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PropertyMedia
 */
class PropertyMediaResource extends JsonResource
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
            'unit_id' => $this->unit_id,
            'caption' => $this->caption,
            'sort_order' => $this->sort_order,
            'is_selected_for_listing' => $this->is_selected_for_listing,
            'revision' => $this->revision,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'preview_url' => $this->preview_url,
            'created_at' => $this->created_at,
        ];
    }
}
