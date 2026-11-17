import { request } from "@/lib/http/client";
import type { TenantTenancy, ParticipantTenancySummary, TenancyTimeline, TenancyRenewalRequest, TenancyRenewalMutationResult, TenancyDecisionResult, OwnerTenancyLifecycleResult, OwnerTenancyProposalResult } from "./types";

export async function getTenantTenancies(): Promise<TenantTenancy[]> {
  return request<TenantTenancy[]>("/api/v1/tenant/tenancies");
}

export async function getOwnerTenancies(): Promise<
  ParticipantTenancySummary[]
> {
  return request<ParticipantTenancySummary[]>("/api/v1/owner/tenancies");
}

export async function getOwnerTenancyTimeline(
  tenancyId: string,
): Promise<TenancyTimeline> {
  return request<TenancyTimeline>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}`,
  );
}

export async function getTenantTenancyTimeline(
  tenancyId: string,
): Promise<TenancyTimeline> {
  return request<TenancyTimeline>(
    `/api/v1/tenant/tenancies/${encodeURIComponent(tenancyId)}`,
  );
}

export async function requestTenantTenancyRenewal(
  tenancyId: string,
  input: {
    client_operation_id: string;
    requested_end_date: string;
    proposed_monthly_rent: number;
    message?: string;
  },
): Promise<TenancyRenewalRequest> {
  return request<TenancyRenewalRequest>(
    `/api/v1/tenant/tenancies/${encodeURIComponent(tenancyId)}/renewal-requests`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function withdrawTenantTenancyRenewal(
  tenancyId: string,
  renewalRequestId: string,
  input: { client_operation_id: string },
): Promise<TenancyRenewalMutationResult> {
  return request<TenancyRenewalMutationResult>(
    `/api/v1/tenant/tenancies/${encodeURIComponent(tenancyId)}/renewal-requests/${encodeURIComponent(renewalRequestId)}/withdraw`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function proposeOwnerTenancyRenewal(
  tenancyId: string,
  renewalRequestId: string,
  input: {
    client_operation_id: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    policies_snapshot: Record<string, unknown>;
  },
): Promise<TenancyRenewalMutationResult> {
  return request<TenancyRenewalMutationResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/renewal-requests/${encodeURIComponent(renewalRequestId)}/proposal`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function correctOwnerTenancyRenewal(
  tenancyId: string,
  renewalRequestId: string,
  input: {
    client_operation_id: string;
    supersedes_contract_id: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    policies_snapshot: Record<string, unknown>;
  },
): Promise<TenancyRenewalMutationResult> {
  return request<TenancyRenewalMutationResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/renewal-requests/${encodeURIComponent(renewalRequestId)}/corrections`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function rejectOwnerTenancyRenewal(
  tenancyId: string,
  renewalRequestId: string,
  input: { client_operation_id: string; reason: string },
): Promise<TenancyRenewalMutationResult> {
  return request<TenancyRenewalMutationResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/renewal-requests/${encodeURIComponent(renewalRequestId)}/reject`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function confirmTenantTenancyContract(
  tenancyId: string,
  contractId: string,
  input: { client_operation_id: string },
): Promise<TenancyDecisionResult> {
  return request<TenancyDecisionResult>(
    `/api/v1/tenant/tenancies/${encodeURIComponent(tenancyId)}/contracts/${encodeURIComponent(contractId)}/confirm`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function declineTenantTenancyContract(
  tenancyId: string,
  contractId: string,
  input: {
    client_operation_id: string;
    reason: string;
  },
): Promise<TenancyDecisionResult> {
  return request<TenancyDecisionResult>(
    `/api/v1/tenant/tenancies/${encodeURIComponent(tenancyId)}/contracts/${encodeURIComponent(contractId)}/decline`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function markOwnerTenancyMoveIn(
  tenancyId: string,
  input: { client_operation_id: string },
): Promise<OwnerTenancyLifecycleResult> {
  return request<OwnerTenancyLifecycleResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/move-in`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function cancelOwnerTenancy(
  tenancyId: string,
  input: { client_operation_id: string; reason: string },
): Promise<OwnerTenancyLifecycleResult> {
  return request<OwnerTenancyLifecycleResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/cancel`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function endOwnerTenancy(
  tenancyId: string,
  input: { client_operation_id: string; reason: string },
): Promise<OwnerTenancyLifecycleResult> {
  return request<OwnerTenancyLifecycleResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/end`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function proposeOwnerTenancy(
  rentalRequestId: string,
  input: {
    client_operation_id: string;
    unit_id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    policies_snapshot: Record<string, unknown>;
  },
): Promise<OwnerTenancyProposalResult> {
  return request<OwnerTenancyProposalResult>(
    `/api/v1/owner/rental-requests/${encodeURIComponent(rentalRequestId)}/proposal`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function correctOwnerTenancyProposal(
  tenancyId: string,
  input: {
    client_operation_id: string;
    supersedes_contract_id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    policies_snapshot: Record<string, unknown>;
    signed_on?: string | null;
  },
): Promise<OwnerTenancyProposalResult> {
  return request<OwnerTenancyProposalResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/correction`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
