<?php

namespace App\Actions\Reports;

use App\Actions\Notifications\RecordNotification;
use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SuspendListingAction
{
    /**
     * Directly suspend a listing by admin with reason and audit trail.
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

            if ($lockedListing->admin_suspended_at !== null) {
                throw new HttpResponseException(
                    response()->json([
                        'message' => 'Tin đăng này hiện đã ở trạng thái đình chỉ.',
                        'suspended_at' => $lockedListing->admin_suspended_at->toIso8601String(),
                    ], 409)
                );
            }

            $now = now();
            $beforeValues = [
                'admin_suspended_at' => null,
                'admin_suspended_by' => null,
                'suspension_reason' => null,
            ];

            $trimmedReason = trim($reason);

            $lockedListing->update([
                'admin_suspended_at' => $now,
                'admin_suspended_by' => $admin->id,
                'suspension_reason' => $trimmedReason,
            ]);

            AuditLog::create([
                'actor_id' => $admin->id,
                'entity_type' => 'listing',
                'entity_id' => $lockedListing->id,
                'action' => 'listing.suspended',
                'before_values' => $beforeValues,
                'after_values' => [
                    'admin_suspended_at' => $now->toIso8601String(),
                    'admin_suspended_by' => $admin->id,
                    'suspension_reason' => $trimmedReason,
                ],
                'reason' => $trimmedReason,
                'correlation_id' => (string) Str::uuid(),
            ]);

            $ownerId = $lockedListing->property?->owner_id;
            if ($ownerId) {
                app(RecordNotification::class)->record(
                    recipientId: (string) $ownerId,
                    audience: 'OWNER',
                    eventKey: 'listing.suspended:'.$lockedListing->id.':'.$now->timestamp,
                    title: 'Tin đăng đã bị đình chỉ',
                    body: 'Tin đăng của bạn đã bị quản trị viên đình chỉ với lý do: '.$trimmedReason,
                    resourceType: 'listing',
                    resourceId: (string) $lockedListing->id,
                    actorId: (string) $admin->id,
                );
            }

            return $lockedListing;
        });
    }
}
