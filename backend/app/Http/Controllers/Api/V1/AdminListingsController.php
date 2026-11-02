<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\OwnerProperties\ListingLifecycleService;
use App\Http\Controllers\Controller;
use App\Http\Requests\RejectListingRequest;
use App\Http\Resources\ListingResource;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Laravel\Sanctum\PersonalAccessToken;

class AdminListingsController extends Controller
{
    public function pending(Request $request): AnonymousResourceCollection
    {
        $this->authorizeAdmin($request);

        return ListingResource::collection(Listing::query()->where('moderation_status', 'PENDING')
            ->whereNull('archived_at')->with('property')->orderBy('submitted_at')->paginate(20));
    }

    public function approve(Request $request, Listing $listing, ListingLifecycleService $service): ListingResource
    {
        $admin = $this->authorizeAdmin($request);

        return new ListingResource($service->review($admin, $listing, true)->load('property'));
    }

    public function reject(RejectListingRequest $request, Listing $listing, ListingLifecycleService $service): ListingResource
    {
        /** @var User $admin */
        $admin = $request->user();

        return new ListingResource($service->review($admin, $listing, false, $request->validated('reason'))->load('property'));
    }

    private function authorizeAdmin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->isAdmin() && $user->account_status === 'ACTIVE', 403);
        abort_if($user->currentAccessToken() instanceof PersonalAccessToken, 403);

        return $user;
    }
}
