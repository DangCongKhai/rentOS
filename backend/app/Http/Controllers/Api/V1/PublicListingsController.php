<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Discovery\EligibleUnitQuery;
use App\Domain\Discovery\ListingPresentation;
use App\Domain\Discovery\ListingSearchCriteria;
use App\Domain\Discovery\LocationQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\PublicListingIndexRequest;
use App\Http\Requests\Api\V1\PublicListingShowRequest;
use App\Http\Resources\PublicListingCardResource;
use App\Http\Resources\PublicListingDetailResource;
use App\Models\Listing;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PublicListingsController extends Controller
{
    public function index(PublicListingIndexRequest $request, ListingPresentation $presentation): JsonResponse
    {
        $criteria = $this->criteria($request);

        return DB::transaction(function () use ($criteria, $presentation): JsonResponse {
            $ids = EligibleUnitQuery::matchingListingIds($criteria);
            $total = count($ids);
            $pageIds = array_slice($ids, ($criteria->page - 1) * $criteria->perPage, $criteria->perPage);
            $listings = $presentation->cardsFor($pageIds, $criteria);

            $meta = [
                'current_page' => $criteria->page,
                'per_page' => $criteria->perPage,
                'total' => $total,
                'last_page' => max(1, (int) ceil($total / $criteria->perPage)),
            ];

            if ($criteria->moveInDate !== null) {
                $meta['result_label'] = $total.' tin đăng còn trống từ '.CarbonImmutable::parse($criteria->moveInDate)->format('d/m/Y');
            }

            return response()->json([
                'data' => PublicListingCardResource::collection($listings),
                'meta' => $meta,
            ]);
        });
    }

    public function show(PublicListingShowRequest $request, string $listing, ListingPresentation $presentation): JsonResponse
    {
        return DB::transaction(function () use ($listing, $presentation): JsonResponse {
            $model = Listing::query()->with('property.owner')->find($listing);
            if (! $model instanceof Listing || ! Listing::query()->publiclyVisible()->whereKey($model->id)->exists()) {
                abort(404);
            }

            $presentation->prepareDetail($model);

            return response()->json([
                'data' => new PublicListingDetailResource($model),
            ]);
        });
    }

    private function criteria(PublicListingIndexRequest $request): ListingSearchCriteria
    {
        /** @var list<string> $amenities */
        $amenities = array_values($request->input('amenities', []));

        return new ListingSearchCriteria(
            location: LocationQuery::fromInput($request->input('location')),
            moveInDate: $request->input('move_in_date'),
            minRent: $request->filled('min_rent') ? $request->integer('min_rent') : null,
            maxRent: $request->filled('max_rent') ? $request->integer('max_rent') : null,
            unitKind: $request->input('unit_kind'),
            bedrooms: $request->filled('bedrooms') ? $request->integer('bedrooms') : null,
            bathrooms: $request->filled('bathrooms') ? $request->integer('bathrooms') : null,
            occupants: $request->filled('occupants') ? $request->integer('occupants') : null,
            amenityKeys: $amenities,
            pets: $request->input('pets'),
            page: $request->integer('page', 1),
            perPage: $request->integer('per_page', 12),
        );
    }
}
