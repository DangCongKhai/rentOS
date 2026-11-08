<?php

namespace App\Actions\Tenancies;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReadTenancyTimeline
{
    /**
     * @return array<string, mixed>
     */
    public function handle(User $viewer, string $tenancyId): array
    {
        $tenancy = DB::table('tenancies')
            ->where('id', $tenancyId)
            ->select([
                'id',
                'owner_id',
                'tenant_id',
                'rental_request_id',
                'unit_id',
                'status',
                'confirmed_start_date',
                'confirmed_end_date',
                'blocked_start_date',
                'blocked_end_date',
                'pending_contract_id',
                'latest_confirmed_contract_id',
                'confirmation_expires_at',
                'moved_in_at',
                'actual_ended_at',
                'end_reason',
                'created_at',
                'updated_at',
            ])
            ->first();

        abort_if($tenancy === null, 404);
        abort_unless(
            $viewer->id === $tenancy->owner_id
                || $viewer->id === $tenancy->tenant_id,
            404,
        );

        $rentalRequest = DB::table('rental_requests')
            ->where('id', $tenancy->rental_request_id)
            ->select([
                'id',
                'status',
                'created_at',
                'closed_at',
                'contact_name',
                'contact_phone',
            ])
            ->first();

        $context = DB::table('tenancies')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->join('properties', 'properties.id', '=', 'units.property_id')
            ->join('users as owners', 'owners.id', '=', 'tenancies.owner_id')
            ->join('users as tenants', 'tenants.id', '=', 'tenancies.tenant_id')
            ->where('tenancies.id', $tenancyId)
            ->select([
                'units.id as unit_id',
                'units.label as unit_label',
                'properties.id as property_id',
                'properties.name as property_name',
                'properties.address_line',
                'properties.ward',
                'properties.city',
                'owners.name as owner_name',
                'tenants.name as tenant_name',
            ])
            ->first();

        abort_if($context === null, 404);

        $contracts = DB::table('tenancy_contracts')
            ->where('tenancy_id', $tenancyId)
            ->orderBy('version_number')
            ->get([
                'id',
                'version_number',
                'type',
                'renewal_request_id',
                'supersedes_contract_id',
                'basis_contract_id',
                'start_date',
                'end_date',
                'monthly_rent',
                'deposit_amount',
                'policies_snapshot',
                'document_sha256',
                'signed_on',
                'created_at',
                'owner_confirmed_at',
                'tenant_confirmed_at',
                'tenant_rejected_at',
                'tenant_rejection_reason',
            ]);

        $pendingContract = $tenancy->pending_contract_id === null
            ? null
            : $contracts->firstWhere('id', $tenancy->pending_contract_id);

        $today = now()->toDateString();

        $currentAgreement = $contracts->first(
            fn (object $contract): bool => $contract->tenant_confirmed_at !== null
                && $contract->tenant_rejected_at === null
                && $contract->start_date <= $today
                && $contract->end_date >= $today,
        );

        $upcomingAgreements = $contracts
            ->filter(
                fn (object $contract): bool => $contract->tenant_confirmed_at !== null
                    && $contract->tenant_rejected_at === null
                    && $contract->start_date > $today,
            )
            ->values();

        $events = DB::table('audit_logs')
            ->where('entity_type', 'tenancy')
            ->where('entity_id', $tenancyId)
            ->orderBy('created_at')
            ->get(['action', 'reason', 'created_at']);

        return [
            'tenancy' => $tenancy,
            'rental_request' => $rentalRequest,
            'property' => [
                'id' => $context->property_id,
                'name' => $context->property_name,
                'address_line' => $context->address_line,
                'ward' => $context->ward,
                'city' => $context->city,
            ],
            'unit' => [
                'id' => $context->unit_id,
                'label' => $context->unit_label,
            ],
            'participants' => [
                'owner_name' => $context->owner_name,
                'tenant_name' => $context->tenant_name,
            ],
            'contracts' => $contracts,
            'pending_contract' => $pendingContract,
            'current_agreement' => $currentAgreement,
            'upcoming_agreements' => $upcomingAgreements,
            'events' => $events,
        ];
    }
}
