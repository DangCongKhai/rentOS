<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tenancies\CloseTenancy;
use App\Actions\Tenancies\MarkTenancyMoveIn;
use App\Http\Controllers\Controller;
use App\Http\Requests\CloseTenancyRequest;
use App\Http\Requests\MarkTenancyMoveInRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class OwnerTenancyLifecycleController extends Controller
{
    public function moveIn(
        MarkTenancyMoveInRequest $request,
        string $tenancy,
        MarkTenancyMoveIn $moveIn,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();

        $result = $moveIn->handle(
            $owner,
            $tenancy,
            $request->validated(),
        );

        return response()->json([
            'data' => [
                'tenancy_id' => $result['tenancy']->id,
                'status' => $result['tenancy']->status,
                'moved_in_at' => $result['tenancy']->moved_in_at,
                'replayed' => $result['replayed'],
            ],
        ]);
    }

    public function cancel(
        CloseTenancyRequest $request,
        string $tenancy,
        CloseTenancy $close,
    ): JsonResponse {
        return $this->close(
            $request,
            $tenancy,
            'cancel',
            $close,
        );
    }

    public function end(
        CloseTenancyRequest $request,
        string $tenancy,
        CloseTenancy $close,
    ): JsonResponse {
        return $this->close(
            $request,
            $tenancy,
            'end',
            $close,
        );
    }

    /**
     * @param  'cancel'|'end'  $transition
     */
    private function close(
        CloseTenancyRequest $request,
        string $tenancy,
        string $transition,
        CloseTenancy $close,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();

        $result = $close->handle(
            $owner,
            $tenancy,
            $transition,
            $request->validated(),
        );

        return response()->json([
            'data' => [
                'tenancy_id' => $result['tenancy']->id,
                'status' => $result['tenancy']->status,
                'actual_ended_at' => $result['tenancy']->actual_ended_at,
                'end_reason' => $result['tenancy']->end_reason,
                'replayed' => $result['replayed'],
            ],
        ]);
    }
}
