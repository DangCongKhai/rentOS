<?php

namespace App\Actions\Reports;

use App\Models\Listing;
use App\Models\ListingReport;
use App\Models\NotificationOutbox;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SubmitListingReportAction
{
    /**
     * Submit a report for a public listing synchronously.
     */
    public function execute(
        Listing $listing,
        User $reporter,
        string $reasonCode,
        string $description,
        ?string $clientOperationId = null
    ): ListingReport {
        return DB::transaction(function () use ($listing, $reporter, $reasonCode, $description, $clientOperationId) {
            // Lock listing to verify public state under lock
            /** @var Listing|null $lockedListing */
            $lockedListing = Listing::query()
                ->where('id', $listing->id)
                ->lockForUpdate()
                ->first();

            if (
                ! $lockedListing
                || $lockedListing->moderation_status !== 'APPROVED'
                || $lockedListing->publication_status !== 'PUBLISHED'
                || $lockedListing->archived_at !== null
                || $lockedListing->admin_suspended_at !== null
            ) {
                throw new HttpResponseException(
                    response()->json([
                        'message' => 'Tin đăng này hiện không khả dụng để tiếp nhận báo cáo.',
                    ], 404)
                );
            }

            // Check if there is already an active report for this reporter and listing
            $existingActiveReport = ListingReport::query()
                ->where('listing_id', $lockedListing->id)
                ->where('reporter_id', $reporter->id)
                ->active()
                ->lockForUpdate()
                ->first();

            if ($existingActiveReport) {
                throw new HttpResponseException(
                    response()->json([
                        'message' => 'Bạn đã có một báo cáo đang được xử lý cho tin đăng này.',
                        'report_id' => $existingActiveReport->id,
                    ], 409)
                );
            }

            // Check idempotency if clientOperationId is provided
            if ($clientOperationId) {
                $idempotentReport = ListingReport::query()
                    ->where('reporter_id', $reporter->id)
                    ->where('client_operation_id', $clientOperationId)
                    ->first();

                if ($idempotentReport) {
                    return $idempotentReport;
                }
            }

            $operationId = $clientOperationId ?? (string) Str::uuid();

            $report = ListingReport::create([
                'listing_id' => $lockedListing->id,
                'reporter_id' => $reporter->id,
                'client_operation_id' => $operationId,
                'reason_code' => $reasonCode,
                'description' => trim($description),
                'status' => ListingReport::STATUS_OPEN,
            ]);

            // Determine admin recipient for notification outbox
            $adminUser = User::query()->where('is_admin', true)->first();
            $recipientId = $adminUser ? $adminUser->id : $reporter->id;

            NotificationOutbox::create([
                'event_key' => 'listing_report.created:'.$report->id,
                'recipient_id' => $recipientId,
                'event_type' => 'listing_report.created',
                'payload' => [
                    'report_id' => $report->id,
                    'listing_id' => $lockedListing->id,
                    'reporter_id' => $reporter->id,
                    'reason_code' => $reasonCode,
                ],
                'status' => 'PENDING',
            ]);

            return $report;
        });
    }
}
