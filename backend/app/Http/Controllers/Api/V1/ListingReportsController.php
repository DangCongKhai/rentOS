<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\SubmitListingReportAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitListingReportRequest;
use App\Http\Resources\ReporterListingReportResource;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ListingReportsController extends Controller
{
    /**
     * Submit a report for a public listing.
     */
    public function store(
        SubmitListingReportRequest $request,
        string $listingId,
        SubmitListingReportAction $action
    ): JsonResponse {
        /** @var User $reporter */
        $reporter = $request->user();

        /** @var Listing|null $listing */
        $listing = Listing::query()->find($listingId);

        if (! $listing) {
            abort(404, 'Không tìm thấy tin đăng.');
        }

        $validated = $request->validated();

        $report = $action->execute(
            listing: $listing,
            reporter: $reporter,
            reasonCode: $validated['reason_code'],
            description: $validated['description'],
            clientOperationId: $validated['client_operation_id'] ?? null,
        );

        $report->load('listing');

        return response()->json([
            'message' => 'Báo cáo của bạn đã được gửi thành công.',
            'data' => new ReporterListingReportResource($report),
        ], 201);
    }
}
