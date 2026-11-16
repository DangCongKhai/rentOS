<?php

namespace App\Http\Resources;

use App\Models\ListingReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ListingReport
 */
class ReporterListingReportResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     * Sanitized for reporter view (FR72): hides internal notes and admin identity.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'listing_id' => $this->listing_id,
            'listing_title' => $this->listing?->title,
            'reason_code' => $this->reason_code,
            'description' => $this->description,
            'status' => $this->status,
            'resolution_summary' => $this->resolution_summary,
            'created_at' => $this->created_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }
}
