<?php

namespace App\Actions\Reports;

use App\Actions\Notifications\RecordNotification;
use App\Models\AuditLog;
use App\Models\ListingReport;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DismissListingReportAction
{
    /**
     * Dismiss a report with sanitized outcome and internal notes.
     */
    public function execute(
        ListingReport $report,
        User $admin,
        string $resolutionSummary,
        ?string $internalNotes = null
    ): ListingReport {
        return DB::transaction(function () use ($report, $admin, $resolutionSummary, $internalNotes) {
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

            // Update report
            $lockedReport->update([
                'status' => ListingReport::STATUS_DISMISSED,
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
                'action' => 'listing_report.dismissed',
                'before_values' => $reportBefore,
                'after_values' => [
                    'status' => ListingReport::STATUS_DISMISSED,
                    'reviewed_by' => $admin->id,
                    'reviewed_at' => $now->toIso8601String(),
                    'resolution_summary' => trim($resolutionSummary),
                ],
                'reason' => 'Report dismissed by admin',
                'correlation_id' => (string) Str::uuid(),
            ]);

            // Notify reporter of safe outcome
            app(RecordNotification::class)->record(
                recipientId: (string) $lockedReport->reporter_id,
                audience: 'TENANT',
                eventKey: 'listing_report.dismissed:'.$lockedReport->id.':'.$now->timestamp,
                title: 'Báo cáo tin đăng đã bị bác bỏ',
                body: trim($resolutionSummary),
                resourceType: 'listing_report',
                resourceId: (string) $lockedReport->id,
                actorId: (string) $admin->id,
            );

            return $lockedReport;
        });
    }
}
