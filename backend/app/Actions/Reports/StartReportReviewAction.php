<?php

namespace App\Actions\Reports;

use App\Models\AuditLog;
use App\Models\ListingReport;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class StartReportReviewAction
{
    /**
     * Transition report from OPEN to REVIEWING.
     */
    public function execute(ListingReport $report, User $admin): ListingReport
    {
        return DB::transaction(function () use ($report, $admin) {
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

            if ($lockedReport->status !== ListingReport::STATUS_OPEN) {
                throw new HttpResponseException(
                    response()->json([
                        'message' => 'Báo cáo này không ở trạng thái chờ xử lý.',
                        'current_status' => $lockedReport->status,
                    ], 409)
                );
            }

            $beforeValues = [
                'status' => $lockedReport->status,
                'reviewed_by' => $lockedReport->reviewed_by,
                'reviewed_at' => $lockedReport->reviewed_at?->toIso8601String(),
            ];

            $now = now();
            $lockedReport->update([
                'status' => ListingReport::STATUS_REVIEWING,
                'reviewed_by' => $admin->id,
                'reviewed_at' => $now,
            ]);

            AuditLog::create([
                'actor_id' => $admin->id,
                'entity_type' => 'listing_report',
                'entity_id' => $lockedReport->id,
                'action' => 'listing_report.review_started',
                'before_values' => $beforeValues,
                'after_values' => [
                    'status' => ListingReport::STATUS_REVIEWING,
                    'reviewed_by' => $admin->id,
                    'reviewed_at' => $now->toIso8601String(),
                ],
                'reason' => 'Admin started investigation',
            ]);

            return $lockedReport;
        });
    }
}
