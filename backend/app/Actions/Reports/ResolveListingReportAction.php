<?php

namespace App\Actions\Reports;

use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\ListingReport;
use App\Models\NotificationOutbox;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

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
                    ]);

                    // Notify owner if available
                    $ownerId = $lockedListing->property?->owner_id;
                    if ($ownerId) {
                        NotificationOutbox::create([
                            'event_key' => 'listing.suspended:'.$lockedListing->id.':'.$now->timestamp,
                            'recipient_id' => $ownerId,
                            'event_type' => 'listing.suspended',
                            'payload' => [
                                'listing_id' => $lockedListing->id,
                                'suspension_reason' => $reason,
                                'suspended_at' => $now->toIso8601String(),
                            ],
                            'status' => 'PENDING',
                        ]);
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
            ]);

            // Notify reporter of safe outcome
            NotificationOutbox::create([
                'event_key' => 'listing_report.resolved:'.$lockedReport->id.':'.$now->timestamp,
                'recipient_id' => $lockedReport->reporter_id,
                'event_type' => 'listing_report.resolved',
                'payload' => [
                    'report_id' => $lockedReport->id,
                    'listing_id' => $lockedReport->listing_id,
                    'status' => ListingReport::STATUS_RESOLVED,
                    'resolution_summary' => trim($resolutionSummary),
                ],
                'status' => 'PENDING',
            ]);

            return $lockedReport;
        });
    }
}
