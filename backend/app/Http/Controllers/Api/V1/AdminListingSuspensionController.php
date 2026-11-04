<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\RestoreListingAction;
use App\Actions\Reports\SuspendListingAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\RestoreListingRequest;
use App\Http\Requests\SuspendListingRequest;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminListingSuspensionController extends Controller
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
     * Suspend a listing directly by admin.
     */
    public function suspend(
        SuspendListingRequest $request,
        string $listingId,
        SuspendListingAction $action
    ): JsonResponse {
        $admin = $this->ensureAdmin($request);

        /** @var Listing|null $listing */
        $listing = Listing::query()->find($listingId);

        if (! $listing) {
            abort(404, 'Không tìm thấy tin đăng.');
        }

        $validated = $request->validated();

        $action->execute($listing, $admin, $validated['reason']);

        return response()->json([
            'message' => 'Tin đăng đã được đình chỉ thành công.',
            'data' => [
                'id' => $listing->id,
                'is_suspended' => true,
                'admin_suspended_at' => $listing->admin_suspended_at?->toIso8601String(),
                'suspension_reason' => $listing->suspension_reason,
            ],
        ]);
    }

    /**
     * Restore a suspended listing by admin.
     */
    public function restore(
        RestoreListingRequest $request,
        string $listingId,
        RestoreListingAction $action
    ): JsonResponse {
        $admin = $this->ensureAdmin($request);

        /** @var Listing|null $listing */
        $listing = Listing::query()->find($listingId);

        if (! $listing) {
            abort(404, 'Không tìm thấy tin đăng.');
        }

        $validated = $request->validated();

        $action->execute($listing, $admin, $validated['reason']);

        return response()->json([
            'message' => 'Tin đăng đã được khôi phục thành công.',
            'data' => [
                'id' => $listing->id,
                'is_suspended' => false,
                'admin_suspended_at' => null,
                'suspension_reason' => null,
            ],
        ]);
    }
}
