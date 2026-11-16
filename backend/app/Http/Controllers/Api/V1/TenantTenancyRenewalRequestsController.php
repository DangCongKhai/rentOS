<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tenancies\RequestTenancyRenewal;
use App\Actions\Tenancies\ResolveTenancyRenewalRequest;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTenancyRenewalRequest;
use App\Http\Requests\WithdrawTenancyRenewalRequest;
use App\Models\User;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Http\JsonResponse;

class TenantTenancyRenewalRequestsController extends Controller
{
    #[Response(201, description: 'Đề nghị gia hạn đã được lưu.', type: 'array{data: array{id: string, tenancy_id: string, requested_end_date: string, proposed_monthly_rent: string, message: string|null, status: "PENDING", created_at: string, replayed: bool}}')]
    #[Response(200, description: 'Kết quả của lần gửi trước với cùng mã thao tác.', type: 'array{data: array{id: string, tenancy_id: string, requested_end_date: string, proposed_monthly_rent: string, message: string|null, status: string, created_at: string, replayed: bool}}')]
    #[Response(409, description: 'Kỳ thuê không đủ điều kiện hoặc đã có quy trình gia hạn khác.', type: 'array{message: string}')]
    public function store(
        StoreTenancyRenewalRequest $request,
        string $tenancy,
        RequestTenancyRenewal $renewalRequest,
    ): JsonResponse {
        /** @var User $tenant */
        $tenant = $request->user();
        $result = $renewalRequest->handle(
            $tenant,
            strtolower($tenancy),
            $request->validated(),
        );
        $item = $result['renewal_request'];

        return response()->json([
            'data' => [
                'id' => $item->id,
                'tenancy_id' => $item->tenancy_id,
                'requested_end_date' => $item->requested_end_date,
                'proposed_monthly_rent' => $item->proposed_monthly_rent,
                'message' => $item->message,
                'status' => $item->status,
                'created_at' => $item->created_at,
                'replayed' => ! $result['created'],
            ],
        ])->setStatusCode($result['created'] ? 201 : 200)
            ->header('Cache-Control', 'private, no-store');
    }

    #[Response(200, description: 'Đề nghị gia hạn đã được rút.', type: 'array{data: array{id: string, tenancy_id: string, status: "CANCELLED", reviewed_at: string, replayed: bool}}')]
    #[Response(409, description: 'Đề nghị gia hạn không còn chờ xử lý.', type: 'array{message: string}')]
    public function withdraw(
        WithdrawTenancyRenewalRequest $request,
        string $tenancy,
        string $renewalRequest,
        ResolveTenancyRenewalRequest $resolve,
    ): JsonResponse {
        /** @var User $tenant */
        $tenant = $request->user();
        $result = $resolve->handle(
            $tenant,
            strtolower($tenancy),
            strtolower($renewalRequest),
            'withdraw',
            $request->validated(),
        );

        return $this->decisionResponse($result);
    }

    /**
     * @param  array{renewal_request: object, tenancy: object, replayed: bool}  $result
     */
    private function decisionResponse(array $result): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $result['renewal_request']->id,
                'tenancy_id' => $result['renewal_request']->tenancy_id,
                'status' => $result['renewal_request']->status,
                'reviewed_at' => $result['renewal_request']->reviewed_at,
                'blocked_end_date' => $result['tenancy']->blocked_end_date,
                'replayed' => $result['replayed'],
            ],
        ])->header('Cache-Control', 'private, no-store');
    }
}
