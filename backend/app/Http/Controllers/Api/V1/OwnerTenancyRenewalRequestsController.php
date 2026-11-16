<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tenancies\CorrectTenancyRenewalProposal;
use App\Actions\Tenancies\ProposeTenancyRenewal;
use App\Actions\Tenancies\ResolveTenancyRenewalRequest;
use App\Http\Controllers\Controller;
use App\Http\Requests\RejectTenancyRenewalRequest;
use App\Http\Requests\StoreTenancyRenewalCorrectionRequest;
use App\Http\Requests\StoreTenancyRenewalProposalRequest;
use App\Models\User;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Http\JsonResponse;

class OwnerTenancyRenewalRequestsController extends Controller
{
    #[Response(201, description: 'Phiên bản gia hạn mới đã được gửi cho người thuê.', type: 'array{data: array{tenancy_id: string, status: string, confirmation_expires_at: string, contract: array{id: string, version_number: int, type: "RENEWAL", supersedes_contract_id: string, basis_contract_id: string, start_date: string, end_date: string}, replayed: bool}}')]
    #[Response(200, description: 'Kết quả của lần điều chỉnh trước với cùng mã thao tác.', type: 'array{data: array{tenancy_id: string, status: string, confirmation_expires_at: string, contract: array{id: string, version_number: int, type: "RENEWAL", supersedes_contract_id: string, basis_contract_id: string, start_date: string, end_date: string}, replayed: bool}}')]
    #[Response(409, description: 'Phiên bản trước không còn đủ điều kiện hoặc khoảng thời gian bị trùng.', type: 'array{message: string}')]
    public function correct(
        StoreTenancyRenewalCorrectionRequest $request,
        string $tenancy,
        string $renewalRequest,
        CorrectTenancyRenewalProposal $corrections,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();
        $result = $corrections->handle(
            $owner,
            strtolower($tenancy),
            strtolower($renewalRequest),
            $request->validated(),
        );

        return response()->json([
            'data' => [
                'tenancy_id' => $result['tenancy']->id,
                'status' => $result['tenancy']->status,
                'confirmation_expires_at' => $result['tenancy']->confirmation_expires_at,
                'contract' => [
                    'id' => $result['contract']->id,
                    'version_number' => $result['contract']->version_number,
                    'type' => $result['contract']->type,
                    'supersedes_contract_id' => $result['contract']->supersedes_contract_id,
                    'basis_contract_id' => $result['contract']->basis_contract_id,
                    'start_date' => $result['contract']->start_date,
                    'end_date' => $result['contract']->end_date,
                ],
                'replayed' => $result['replayed'],
            ],
        ], $result['replayed'] ? 200 : 201)->header('Cache-Control', 'private, no-store');
    }

    #[Response(201, description: 'Đề xuất gia hạn đã được gửi cho người thuê.', type: 'array{data: array{tenancy_id: string, status: string, confirmation_expires_at: string, contract: array{id: string, version_number: int, type: "RENEWAL", start_date: string, end_date: string}, replayed: bool}}')]
    #[Response(200, description: 'Kết quả của lần gửi trước với cùng mã thao tác.', type: 'array{data: array{tenancy_id: string, status: string, confirmation_expires_at: string, contract: array{id: string, version_number: int, type: "RENEWAL", start_date: string, end_date: string}, replayed: bool}}')]
    #[Response(409, description: 'Đề nghị không còn chờ, đã có đề xuất khác hoặc khoảng thời gian bị trùng.', type: 'array{message: string}')]
    public function propose(
        StoreTenancyRenewalProposalRequest $request,
        string $tenancy,
        string $renewalRequest,
        ProposeTenancyRenewal $proposals,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();
        $result = $proposals->handle(
            $owner,
            strtolower($tenancy),
            strtolower($renewalRequest),
            $request->validated(),
        );

        return response()->json([
            'data' => [
                'tenancy_id' => $result['tenancy']->id,
                'status' => $result['tenancy']->status,
                'confirmation_expires_at' => $result['tenancy']->confirmation_expires_at,
                'contract' => [
                    'id' => $result['contract']->id,
                    'version_number' => $result['contract']->version_number,
                    'type' => $result['contract']->type,
                    'basis_contract_id' => $result['contract']->basis_contract_id,
                    'start_date' => $result['contract']->start_date,
                    'end_date' => $result['contract']->end_date,
                    'monthly_rent' => $result['contract']->monthly_rent,
                    'deposit_amount' => $result['contract']->deposit_amount,
                ],
                'replayed' => $result['replayed'],
            ],
        ], $result['replayed'] ? 200 : 201)->header('Cache-Control', 'private, no-store');
    }

    #[Response(200, description: 'Đề nghị gia hạn đã bị từ chối.', type: 'array{data: array{id: string, tenancy_id: string, status: "REJECTED", reviewed_at: string, review_reason: string, blocked_end_date: string, replayed: bool}}')]
    #[Response(409, description: 'Đề nghị gia hạn không còn chờ xử lý.', type: 'array{message: string}')]
    public function reject(
        RejectTenancyRenewalRequest $request,
        string $tenancy,
        string $renewalRequest,
        ResolveTenancyRenewalRequest $resolve,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();
        $result = $resolve->handle(
            $owner,
            strtolower($tenancy),
            strtolower($renewalRequest),
            'reject',
            $request->validated(),
        );

        return response()->json([
            'data' => [
                'id' => $result['renewal_request']->id,
                'tenancy_id' => $result['renewal_request']->tenancy_id,
                'status' => $result['renewal_request']->status,
                'reviewed_at' => $result['renewal_request']->reviewed_at,
                'review_reason' => $result['renewal_request']->review_reason,
                'blocked_end_date' => $result['tenancy']->blocked_end_date,
                'replayed' => $result['replayed'],
            ],
        ])->header('Cache-Control', 'private, no-store');
    }
}
