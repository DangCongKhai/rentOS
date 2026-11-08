<?php

namespace App\Actions\Tenancies;

use App\Domain\Tenancies\ContractDocumentStorage;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class IssueTenancyContractDownload
{
    public function __construct(
        private ContractDocumentStorage $documents,
    ) {}

    /**
     * @return array{contract_id: string, version_number: int, url: string, expires_in: int}
     */
    public function handle(
        User $viewer,
        string $tenancyId,
        string $contractId,
    ): array {
        $tenancy = DB::table('tenancies')
            ->where('id', $tenancyId)
            ->select(['id', 'owner_id', 'tenant_id'])
            ->first();

        abort_if($tenancy === null, 404);
        abort_unless(
            $viewer->id === $tenancy->owner_id
                || $viewer->id === $tenancy->tenant_id,
            404,
        );

        $contract = DB::table('tenancy_contracts')
            ->where('tenancy_id', $tenancyId)
            ->where('id', $contractId)
            ->first(['id', 'version_number', 'document_path']);

        abort_if($contract === null, 404);

        $expiresIn = 300;

        return [
            'contract_id' => $contract->id,
            'version_number' => (int) $contract->version_number,
            'url' => $this->documents->signedDownloadUrl(
                $contract->document_path,
                $expiresIn,
            ),
            'expires_in' => $expiresIn,
        ];
    }
}
