<?php

namespace App\Actions\Reports;

use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\NotificationOutbox;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class RestoreListingAction
{
    /**
     * Restore a suspended listing by admin with reason and audit trail.
     * Preserves owner publication_status and moderation_status.
     */
    public function execute(Listing $listing, User $admin, string $reason): Listing
    {
        return DB::transaction(function () use ($listing, $admin, $reason) {
            /** @var Listing|null $lockedListing */
            $lockedListing = Listing::query()
                ->where('id', $listing->id)
                ->lockForUpdate()
                ->first();

            if (! $lockedListing) {
                throw new HttpResponseException(
                    response()->json(['message' => 'Không tìm thấy tin đăng.'], 404)
                );
            }

            if ($lockedListing->admin_suspended_at === null) {
                throw new HttpResponseException(
                    response()->json([
                        'message' => 'Tin đăng này không ở trạng thái đình chỉ.',
                    ], 409)
                );
            }

            $now = now();
            $beforeValues = [
                'admin_suspended_at' => $lockedListing->admin_suspended_at->toIso8601String(),
                'admin_suspended_by' => $lockedListing->admin_suspended_by,
                'suspension_reason' => $lockedListing->suspension_reason,
            ];

            $trimmedReason = trim($reason);

            $lockedListing->update([
                'admin_suspended_at' => null,
                'admin_suspended_by' => null,
                'suspension_reason' => null,
            ]);

            AuditLog::create([
                'actor_id' => $admin->id,
                'entity_type' => 'listing',
                'entity_id' => $lockedListing->id,
                'action' => 'listing.restored',
                'before_values' => $beforeValues,
                'after_values' => [
                    'admin_suspended_at' => null,
                    'admin_suspended_by' => null,
                    'suspension_reason' => null,
                ],
                'reason' => $trimmedReason,
            ]);

            $ownerId = $lockedListing->property?->owner_id;
            if ($ownerId) {
                NotificationOutbox::create([
                    'event_key' => 'listing.restored:'.$lockedListing->id.':'.$now->timestamp,
                    'recipient_id' => $ownerId,
                    'event_type' => 'listing.restored',
                    'payload' => [
                        'listing_id' => $lockedListing->id,
                        'restoration_reason' => $trimmedReason,
                        'restored_at' => $now->toIso8601String(),
                    ],
                    'status' => 'PENDING',
                ]);
            }

            return $lockedListing;
        });
    }
}
