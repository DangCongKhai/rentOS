<?php

namespace App\Actions\Reports;

use App\Actions\Notifications\RecordNotification;
use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
                'correlation_id' => (string) Str::uuid(),
            ]);

            $ownerId = $lockedListing->property?->owner_id;
            if ($ownerId) {
                app(RecordNotification::class)->record(
                    recipientId: (string) $ownerId,
                    audience: 'OWNER',
                    eventKey: 'listing.restored:'.$lockedListing->id.':'.$now->timestamp,
                    title: 'Tin đăng đã được khôi phục',
                    body: 'Tin đăng của bạn đã được quản trị viên khôi phục: '.$trimmedReason,
                    resourceType: 'listing',
                    resourceId: (string) $lockedListing->id,
                    actorId: (string) $admin->id,
                );
            }

            return $lockedListing;
        });
    }
}
