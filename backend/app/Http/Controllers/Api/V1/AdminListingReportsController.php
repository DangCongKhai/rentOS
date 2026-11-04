<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\DismissListingReportAction;
use App\Actions\Reports\ResolveListingReportAction;
use App\Actions\Reports\StartReportReviewAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\DismissListingReportRequest;
use App\Http\Requests\ResolveListingReportRequest;
use App\Http\Resources\AdminListingReportResource;
use App\Models\ListingReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminListingReportsController extends Controller
{
    /**
     * Enforce non-disclosure: return 404 for non-admin users.
     */
    private function ensureAdmin(Request $request): User
    {
        /** @var User|null $user */
        $user = $request->user();

        if (! $user || ! $user->isAdmin()) {
            abort(404);
        }

        return $user;
    }

    /**
     * List reports with optional status, reason filters, and search.
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $query = ListingReport::query()
            ->with(['listing.property.owner', 'reporter', 'reviewer']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('reason_code')) {
            $query->where('reason_code', $request->input('reason_code'));
        }

        if ($request->filled('search')) {
            $search = (string) $request->input('search');
            $query->where(function (Builder $q) use ($search) {
                $q->whereHas('listing', function (Builder $listingQuery) use ($search) {
                    $listingQuery->where('title', 'ilike', "%{$search}%");
                })->orWhereHas('reporter', function (Builder $reporterQuery) use ($search) {
                    $reporterQuery->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%");
                });
            });
        }

        $reports = $query->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => AdminListingReportResource::collection($reports->items()),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
                'last_page' => $reports->lastPage(),
            ],
        ]);
    }

    /**
     * View investigation detail for a single report.
     */
    public function show(Request $request, string $reportId): JsonResponse
    {
        $this->ensureAdmin($request);

        /** @var ListingReport|null $report */
        $report = ListingReport::query()
            ->with(['listing.property.owner', 'reporter', 'reviewer'])
            ->find($reportId);

        if (! $report) {
            abort(404, 'Không tìm thấy báo cáo.');
        }

        return response()->json([
            'data' => new AdminListingReportResource($report),
        ]);
    }

    /**
     * Transition report status to REVIEWING.
     */
    public function startReview(
        Request $request,
        string $reportId,
        StartReportReviewAction $action
    ): JsonResponse {
        $admin = $this->ensureAdmin($request);

        /** @var ListingReport|null $report */
        $report = ListingReport::query()->find($reportId);

        if (! $report) {
            abort(404, 'Không tìm thấy báo cáo.');
        }

        $action->execute($report, $admin);

        $report->load(['listing.property.owner', 'reporter', 'reviewer']);

        return response()->json([
            'message' => 'Đã tiếp nhận điều tra báo cáo.',
            'data' => new AdminListingReportResource($report),
        ]);
    }

    /**
     * Resolve report with outcome, internal notes, and optional listing suspension.
     */
    public function resolve(
        ResolveListingReportRequest $request,
        string $reportId,
        ResolveListingReportAction $action
    ): JsonResponse {
        $admin = $this->ensureAdmin($request);

        /** @var ListingReport|null $report */
        $report = ListingReport::query()->find($reportId);

        if (! $report) {
            abort(404, 'Không tìm thấy báo cáo.');
        }

        $validated = $request->validated();

        $action->execute(
            report: $report,
            admin: $admin,
            resolutionSummary: $validated['resolution_summary'],
            internalNotes: $validated['internal_notes'] ?? null,
            suspendListing: (bool) ($validated['suspend_listing'] ?? false),
            suspensionReason: $validated['suspension_reason'] ?? null,
        );

        $report->load(['listing.property.owner', 'reporter', 'reviewer']);

        return response()->json([
            'message' => 'Báo cáo đã được xử lý thành công.',
            'data' => new AdminListingReportResource($report),
        ]);
    }

    /**
     * Dismiss report with safe outcome and internal notes.
     */
    public function dismiss(
        DismissListingReportRequest $request,
        string $reportId,
        DismissListingReportAction $action
    ): JsonResponse {
        $admin = $this->ensureAdmin($request);

        /** @var ListingReport|null $report */
        $report = ListingReport::query()->find($reportId);

        if (! $report) {
            abort(404, 'Không tìm thấy báo cáo.');
        }

        $validated = $request->validated();

        $action->execute(
            report: $report,
            admin: $admin,
            resolutionSummary: $validated['resolution_summary'],
            internalNotes: $validated['internal_notes'] ?? null,
        );

        $report->load(['listing.property.owner', 'reporter', 'reviewer']);

        return response()->json([
            'message' => 'Báo cáo đã được bác bỏ.',
            'data' => new AdminListingReportResource($report),
        ]);
    }
}
