export type ParticipantTenancySummary = {
  id: string;
  unit_id: string;
  tenant_id: string;
  owner_id: string;
  rental_request_id: string;
  status: string;
  confirmed_start_date: string | null;
  confirmed_end_date: string | null;
  blocked_start_date: string | null;
  blocked_end_date: string | null;
  pending_contract_id: string | null;
  latest_confirmed_contract_id: string | null;
  confirmation_expires_at: string | null;
  moved_in_at: string | null;
  actual_ended_at: string | null;
  end_reason: string | null;
  created_at: string;
  updated_at: string;
  property_name: string;
  property_city: string | null;
  unit_label: string;
  rental_request_status: string;
  counterparty_name: string;
  pending_contract_version: number | null;
  pending_contract_start_date: string | null;
  pending_contract_end_date: string | null;
  pending_contract_monthly_rent: string | number | null;
  pending_contract_deposit_amount: string | number | null;
  latest_confirmed_contract_version: number | null;
  latest_confirmed_contract_start_date: string | null;
  latest_confirmed_contract_end_date: string | null;
  latest_confirmed_contract_monthly_rent: string | number | null;
  latest_confirmed_contract_deposit_amount: string | number | null;
};

export type TenantTenancy = ParticipantTenancySummary;

export type TenancyContractRecord = {
  id: string;
  version_number: number;
  type: string;
  renewal_request_id: string | null;
  supersedes_contract_id: string | null;
  basis_contract_id: string | null;
  start_date: string;
  end_date: string;
  monthly_rent: string | number;
  deposit_amount: string | number;
  policies_snapshot: Record<string, unknown> | string;
  signed_on: string | null;
  created_at: string;
  owner_confirmed_at: string | null;
  tenant_confirmed_at: string | null;
  tenant_rejected_at: string | null;
  tenant_rejection_reason: string | null;
};

export type TenancyRenewalRequest = {
  id: string;
  requested_end_date: string;
  proposed_monthly_rent: string | number;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TenancyTimeline = {
  tenancy: {
    id: string;
    owner_id: string;
    tenant_id: string;
    rental_request_id: string;
    unit_id: string;
    status: string;
    confirmed_start_date: string | null;
    confirmed_end_date: string | null;
    blocked_start_date: string | null;
    blocked_end_date: string | null;
    pending_contract_id: string | null;
    latest_confirmed_contract_id: string | null;
    confirmation_expires_at: string | null;
    moved_in_at: string | null;
    actual_ended_at: string | null;
    end_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  rental_request: {
    id: string;
    status: string;
    created_at: string;
    closed_at: string | null;
    contact_name: string;
    contact_phone: string;
  } | null;
  property: {
    id: string;
    name: string;
    address_line: string | null;
    ward: string | null;
    city: string | null;
  };
  unit: {
    id: string;
    label: string;
  };
  participants: {
    owner_name: string;
    tenant_name: string;
  };
  contracts: TenancyContractRecord[];
  renewal_requests: TenancyRenewalRequest[];
  pending_contract: TenancyContractRecord | null;
  current_agreement: TenancyContractRecord | null;
  upcoming_agreements: TenancyContractRecord[];
  events: Array<{
    entity_type: string;
    action: string;
    reason: string | null;
    correlation_id: string | null;
    created_at: string;
  }>;
};

export type TenancyRenewalMutationResult = {
  id?: string;
  tenancy_id: string;
  status?: string;
  confirmation_expires_at?: string | null;
  blocked_end_date?: string | null;
  replayed: boolean;
  contract?: {
    id: string;
    version_number: number;
    type: "RENEWAL";
    start_date: string;
    end_date: string;
    monthly_rent?: string | number;
    deposit_amount?: string | number;
    supersedes_contract_id?: string | null;
    basis_contract_id?: string | null;
  };
};

export type TenancyDecisionResult = {
  tenancy_id: string;
  status: string;
  contract_id: string;
  version_number: number;
  replayed: boolean;
  confirmed_start_date?: string | null;
  confirmed_end_date?: string | null;
  tenant_rejected_at?: string | null;
  reason?: string | null;
};

export type OwnerTenancyLifecycleResult = {
  tenancy_id: string;
  status: string;
  replayed: boolean;
  moved_in_at?: string | null;
  actual_ended_at?: string | null;
  end_reason?: string | null;
};

export type OwnerTenancyProposalResult = {
  tenancy_id: string;
  status: string;
  confirmation_expires_at: string;
  contract: {
    id: string;
    version_number: number;
    type: string;
    supersedes_contract_id?: string;
  };
  replayed: boolean;
};
