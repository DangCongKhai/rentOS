<?php

namespace App\Http\Resources;

use App\Models\ListingReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ListingReport
 */
class AdminListingReportResource extends JsonResource
{
    /**
     * Transform the resource into an array for Admin investigation list and detail.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'listing_id' => $this->listing_id,
            'listing' => [
                'id' => $this->listing?->id,
                'title' => $this->listing?->title,
                'publication_status' => $this->listing?->publication_status,
                'moderation_status' => $this->listing?->moderation_status,
                'is_suspended' => $this->listing?->isSuspended() ?? false,
                'admin_suspended_at' => $this->listing?->admin_suspended_at?->toIso8601String(),
                'suspension_reason' => $this->listing?->suspension_reason,
                'property_id' => $this->listing?->property_id,
                'owner' => [
                    'id' => $this->listing?->property?->owner?->id,
                    'name' => $this->listing?->property?->owner?->name,
                    'email' => $this->listing?->property?->owner?->email,
                ],
            ],
            'reporter' => [
                'id' => $this->reporter?->id,
                'name' => $this->reporter?->name,
                'email' => $this->reporter?->email,
            ],
            'reason_code' => $this->reason_code,
            'description' => $this->description,
            'status' => $this->status,
            'resolution_summary' => $this->resolution_summary,
            'internal_notes' => $this->internal_notes,
            'reviewer' => $this->reviewer ? [
                'id' => $this->reviewer->id,
                'name' => $this->reviewer->name,
                'email' => $this->reviewer->email,
            ] : null,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
