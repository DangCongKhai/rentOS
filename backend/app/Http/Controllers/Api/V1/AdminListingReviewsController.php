<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Listings\DecideListingReview;
use App\Actions\Listings\ListListingReviews;
use App\Actions\Listings\ReadListingReviewPackage;
use App\Http\Controllers\Controller;
use App\Http\Requests\AdminListingReviewDecisionRequest;
use App\Http\Requests\AdminListingReviewQueryRequest;
use App\Http\Resources\AdminListingReviewResource;
use App\Http\Resources\AdminListingReviewSummaryResource;
use App\Models\Listing;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class AdminListingReviewsController extends Controller
{
    public function index(AdminListingReviewQueryRequest $request, ListListingReviews $reviews): AnonymousResourceCollection
    {
        $input = $request->validated();
        $page = $reviews->query($input['q'] ?? '')->paginate($input['per_page'] ?? 10)->withQueryString();
        $page->through(fn (object $row): array => $reviews->summary($row));

        return AdminListingReviewSummaryResource::collection($page);
    }

    public function show(string $listing, ReadListingReviewPackage $packages): AdminListingReviewResource
    {
        Gate::authorize('viewAny', Listing::class);

        return new AdminListingReviewResource($packages->handle($listing));
    }

    public function approve(AdminListingReviewDecisionRequest $request, string $listing, DecideListingReview $decision): AdminListingReviewResource
    {
        return new AdminListingReviewResource($decision->handle($request->user(), $listing, true, $request->validated()));
    }

    public function reject(AdminListingReviewDecisionRequest $request, string $listing, DecideListingReview $decision): AdminListingReviewResource
    {
        return new AdminListingReviewResource($decision->handle($request->user(), $listing, false, $request->validated()));
    }
}
