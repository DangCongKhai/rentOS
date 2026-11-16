<?php

namespace App\Actions\Reports;

use App\Actions\Notifications\RecordNotification;
use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\ListingReport;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ResolveListingReportAction
{
    /**
     * Resolve a report with sanitized outcome, internal notes, and optional atomic listing suspension.
     */
    public function execute(
        ListingReport $report,
        User $admin,
        string $resolutionSummary,
        ?string $internalNotes = null,
        bool $suspendListing = false,
        ?string $suspensionReason = null
    ): ListingReport {
        return DB::transaction(function () use (
            $report,
            $admin,
            $resolutionSummary,
            $internalNotes,
            $suspendListing,
            $suspensionReason
        ) {
            /** @var ListingReport|null $lockedReport */
            $lockedReport = ListingReport::query()
                ->where('id', $report->id)
                ->lockForUpdate()
                ->first();

            if (! $lockedReport) {
                throw new HttpResponseException(
                    response()->json(['message' => 'Không tìm thấy báo cáo.'], 404)
                );
            }

            if (in_array($lockedReport->status, [ListingReport::STATUS_RESOLVED, ListingReport::STATUS_DISMISSED], true)) {
                throw new HttpResponseException(
                    response()->json([
                        'message' => 'Báo cáo này đã được xử lý bởi một quản trị viên khác.',
                        'current_status' => $lockedReport->status,
                    ], 409)
                );
            }

            if ($lockedReport->status !== ListingReport::STATUS_REVIEWING) {
                throw new HttpResponseException(
                    response()->json([
                        'message' => 'Báo cáo phải ở trạng thái đang điều tra trước khi được giải quyết.',
                        'current_status' => $lockedReport->status,
                    ], 409)
                );
            }

            $now = now();
            $reportBefore = [
                'status' => $lockedReport->status,
                'reviewed_by' => $lockedReport->reviewed_by,
                'reviewed_at' => $lockedReport->reviewed_at?->toIso8601String(),
                'resolution_summary' => $lockedReport->resolution_summary,
            ];

            // Atomic listing suspension if requested
            if ($suspendListing) {
                /** @var Listing|null $lockedListing */
                $lockedListing = Listing::query()
                    ->where('id', $lockedReport->listing_id)
                    ->lockForUpdate()
                    ->first();

                if ($lockedListing && ! $lockedListing->admin_suspended_at) {
                    $reason = $suspensionReason ?: $resolutionSummary;
                    $listingBefore = [
                        'admin_suspended_at' => null,
                        'admin_suspended_by' => null,
                        'suspension_reason' => null,
                    ];

                    $lockedListing->update([
                        'admin_suspended_at' => $now,
                        'admin_suspended_by' => $admin->id,
                        'suspension_reason' => $reason,
                    ]);

                    AuditLog::create([
                        'actor_id' => $admin->id,
                        'entity_type' => 'listing',
                        'entity_id' => $lockedListing->id,
                        'action' => 'listing.suspended',
                        'before_values' => $listingBefore,
                        'after_values' => [
                            'admin_suspended_at' => $now->toIso8601String(),
                            'admin_suspended_by' => $admin->id,
                            'suspension_reason' => $reason,
                        ],
                        'reason' => 'Suspended via report resolution',
                        'correlation_id' => (string) Str::uuid(),
                    ]);

                    // Notify owner if available
                    $ownerId = $lockedListing->property?->owner_id;
                    if ($ownerId) {
                        app(RecordNotification::class)->record(
                            recipientId: (string) $ownerId,
                            audience: 'OWNER',
                            eventKey: 'listing.suspended:'.$lockedListing->id.':'.$now->timestamp,
                            title: 'Tin đăng đã bị đình chỉ',
                            body: 'Tin đăng của bạn đã bị đình chỉ với lý do: '.$reason,
                            resourceType: 'listing',
                            resourceId: (string) $lockedListing->id,
                            actorId: (string) $admin->id,
                        );
                    }
                }
            }

            // Update report
            $lockedReport->update([
                'status' => ListingReport::STATUS_RESOLVED,
                'resolution_summary' => trim($resolutionSummary),
                'internal_notes' => $internalNotes !== null ? trim($internalNotes) : null,
                'reviewed_by' => $admin->id,
                'reviewed_at' => $now,
            ]);

            // Audit log for report
            AuditLog::create([
                'actor_id' => $admin->id,
                'entity_type' => 'listing_report',
                'entity_id' => $lockedReport->id,
                'action' => 'listing_report.resolved',
                'before_values' => $reportBefore,
                'after_values' => [
                    'status' => ListingReport::STATUS_RESOLVED,
                    'reviewed_by' => $admin->id,
                    'reviewed_at' => $now->toIso8601String(),
                    'resolution_summary' => trim($resolutionSummary),
                ],
                'reason' => 'Report resolved by admin',
                'correlation_id' => (string) Str::uuid(),
            ]);

            // Notify reporter of safe outcome
            app(RecordNotification::class)->record(
                recipientId: (string) $lockedReport->reporter_id,
                audience: 'TENANT',
                eventKey: 'listing_report.resolved:'.$lockedReport->id.':'.$now->timestamp,
                title: 'Báo cáo tin đăng đã được xử lý',
                body: trim($resolutionSummary),
                resourceType: 'listing_report',
                resourceId: (string) $lockedReport->id,
                actorId: (string) $admin->id,
            );

            return $lockedReport;
        });
    }
}
