<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tenancies\CorrectTenancyProposal;
use App\Actions\Tenancies\ProposeTenancy;
use App\Http\Controllers\Controller;
use App\Http\Requests\CorrectTenancyProposalRequest;
use App\Http\Requests\StoreTenancyProposalRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class OwnerTenancyProposalsController extends Controller
{
    public function store(
        StoreTenancyProposalRequest $request,
        string $rentalRequest,
        ProposeTenancy $proposals,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();

        $result = $proposals->handle(
            $owner,
            $rentalRequest,
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
                    'document_sha256' => $result['contract']->document_sha256,
                ],
                'replayed' => $result['replayed'],
            ],
        ], $result['replayed'] ? 200 : 201);
    }

    public function correct(
        CorrectTenancyProposalRequest $request,
        string $tenancy,
        CorrectTenancyProposal $corrections,
    ): JsonResponse {
        /** @var User $owner */
        $owner = $request->user();

        $result = $corrections->handle(
            $owner,
            $tenancy,
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
                    'document_sha256' => $result['contract']->document_sha256,
                ],
                'replayed' => $result['replayed'],
            ],
        ], $result['replayed'] ? 200 : 201);
    }
}
