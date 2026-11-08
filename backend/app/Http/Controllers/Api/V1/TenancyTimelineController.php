<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tenancies\IssueTenancyContractDownload;
use App\Actions\Tenancies\ListParticipantTenancies;
use App\Actions\Tenancies\ReadTenancyTimeline;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class TenancyTimelineController extends Controller
{
    public function show(
        Request $request,
        string $tenancy,
        ReadTenancyTimeline $timeline,
    ): JsonResponse {
        /** @var User $viewer */
        $viewer = $request->user();

        return response()->json([
            'data' => $timeline->handle($viewer, $tenancy),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function downloadContract(
        Request $request,
        string $tenancy,
        string $contract,
        IssueTenancyContractDownload $downloads,
    ): JsonResponse {
        /** @var User $viewer */
        $viewer = $request->user();

        return response()->json([
            'data' => $downloads->handle($viewer, $tenancy, $contract),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function ownerIndex(
        Request $request,
        ListParticipantTenancies $tenancies,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();

        abort_unless(
            $owner->canManageOwnerProducts()
                && ! ($owner->currentAccessToken() instanceof PersonalAccessToken),
            404,
        );

        return response()->json([
            'data' => $tenancies->forOwner($owner),
        ])->header('Cache-Control', 'private, no-store');
    }
}
