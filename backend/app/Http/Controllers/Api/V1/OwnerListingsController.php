<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\OwnerProperties\ListingLifecycleService;
use App\Http\Controllers\Controller;
use App\Http\Requests\ListingStateRequest;
use App\Http\Requests\StoreListingRequest;
use App\Http\Requests\UpdateListingRequest;
use App\Http\Resources\ListingResource;
use App\Models\Listing;
use App\Models\Property;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Laravel\Sanctum\PersonalAccessToken;

class OwnerListingsController extends Controller
{
    public function show(Request $request, Property $property): ListingResource
    {
        $this->authorizeOwner($request, $property);
        $listing = Listing::query()->where('property_id', $property->id)->whereNull('archived_at')->firstOrFail();

        return new ListingResource($listing->load('property'));
    }

    public function store(StoreListingRequest $request, Property $property, ListingLifecycleService $service): JsonResponse
    {
        $result = $service->create($request->user(), $property, $request->validated());

        return (new ListingResource($result['listing']->load('property')))->response()->setStatusCode($result['replayed'] ? 200 : 201);
    }

    public function update(UpdateListingRequest $request, Property $property, ListingLifecycleService $service): ListingResource
    {
        return new ListingResource($service->update($request->user(), $property, $request->validated())->load('property'));
    }

    public function submit(ListingStateRequest $request, Property $property, ListingLifecycleService $service): ListingResource
    {
        return new ListingResource($service->submit($request->user(), $property, (int) $request->validated('expected_content_revision'))->load('property'));
    }

    public function publish(ListingStateRequest $request, Property $property, ListingLifecycleService $service): ListingResource
    {
        return new ListingResource($service->publish($request->user(), $property, (int) $request->validated('expected_content_revision'))->load('property'));
    }

    public function hide(ListingStateRequest $request, Property $property, ListingLifecycleService $service): ListingResource
    {
        return new ListingResource($service->hide($request->user(), $property, (int) $request->validated('expected_content_revision'))->load('property'));
    }

    public function archive(ListingStateRequest $request, Property $property, ListingLifecycleService $service): ListingResource
    {
        return new ListingResource($service->archive($request->user(), $property, (int) $request->validated('expected_content_revision'))->load('property'));
    }

    private function authorizeOwner(Request $request, Property $property): void
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->canManageOwnerProducts(), 403);
        abort_if($user->currentAccessToken() instanceof PersonalAccessToken, 403);
        Gate::authorize('update', $property);
    }
}
