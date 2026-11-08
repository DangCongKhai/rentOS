<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tenancies\ConfirmTenancyContract;
use App\Actions\Tenancies\DeclineTenancyContract;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmTenancyContractRequest;
use App\Http\Requests\DeclineTenancyContractRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenantTenanciesController extends Controller
{
    /**
     * Get active or confirmed tenancies for the authenticated tenant.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $tenancies = DB::table('tenancies')
            ->where('tenant_id', $user->id)
            ->whereIn('status', ['ACTIVE', 'CONFIRMED'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $tenancies,
        ]);
    }

    public function confirmContract(
        ConfirmTenancyContractRequest $request,
        string $tenancy,
        string $contract,
        ConfirmTenancyContract $confirmation,
    ): JsonResponse {
        /** @var User $tenant */
        $tenant = $request->user();

        $result = $confirmation->handle(
            $tenant,
            $tenancy,
            $contract,
            $request->validated(),
        );

        return response()->json([
            'data' => [
                'tenancy_id' => $result['tenancy']->id,
                'status' => $result['tenancy']->status,
                'confirmed_start_date' => $result['tenancy']->confirmed_start_date,
                'confirmed_end_date' => $result['tenancy']->confirmed_end_date,
                'contract_id' => $result['contract']->id,
                'version_number' => $result['contract']->version_number,
                'document_sha256' => $result['contract']->document_sha256,
                'replayed' => $result['replayed'],
            ],
        ]);
    }

    public function declineContract(
        DeclineTenancyContractRequest $request,
        string $tenancy,
        string $contract,
        DeclineTenancyContract $decline,
    ): JsonResponse {
        /** @var User $tenant */
        $tenant = $request->user();

        $result = $decline->handle(
            $tenant,
            $tenancy,
            $contract,
            $request->validated(),
        );

        return response()->json([
            'data' => [
                'tenancy_id' => $result['tenancy']->id,
                'status' => $result['tenancy']->status,
                'contract_id' => $result['contract']->id,
                'version_number' => $result['contract']->version_number,
                'document_sha256' => $result['contract']->document_sha256,
                'tenant_rejected_at' => $result['contract']->tenant_rejected_at,
                'reason' => $result['contract']->tenant_rejection_reason,
                'replayed' => $result['replayed'],
            ],
        ]);
    }
}
