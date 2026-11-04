<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReporterListingReportResource;
use App\Models\ListingReport;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantReportsController extends Controller
{
    /**
     * List all reports submitted by the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $reports = ListingReport::query()
            ->where('reporter_id', $user->id)
            ->with('listing')
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        return response()->json([
            'data' => ReporterListingReportResource::collection($reports->items()),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
                'last_page' => $reports->lastPage(),
            ],
        ]);
    }

    /**
     * View a specific report submitted by the authenticated user.
     */
    public function show(Request $request, string $reportId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        /** @var ListingReport|null $report */
        $report = ListingReport::query()
            ->where('id', $reportId)
            ->where('reporter_id', $user->id)
            ->with('listing')
            ->first();

        if (! $report) {
            abort(404, 'Không tìm thấy báo cáo.');
        }

        return response()->json([
            'data' => new ReporterListingReportResource($report),
        ]);
    }
}
