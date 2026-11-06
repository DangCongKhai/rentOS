import { request } from "@/lib/auth-api";

type SubmitRentalRequestInput = {
  listing_id: string;
  contact_name: string;
  contact_phone: string;
  desired_move_in_date: string;
  desired_end_date: string;
  preferred_unit_id: string | null;
  message: string;
  client_operation_id: string;
};

type SubmittedRentalRequest = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
};

export function submitRentalRequest(input: SubmitRentalRequestInput) {
  return request<SubmittedRentalRequest>("/api/v1/tenant/rental-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type RentalRequestStatus = SubmittedRentalRequest["status"];
export type RentalRequestFilter = "all" | "pending" | "accepted" | "closed";

export type TenantRentalRequest = {
  id: string;
  title: string;
  ward: string | null;
  city: string | null;
  desired_move_in_date: string;
  desired_end_date: string;
  preferred_unit: string | null;
  status: RentalRequestStatus;
  outcome_reason: string | null;
  updated_at: string;
  created_at: string;
  closed_at: string | null;
  tenancy: { id: string; status: string; confirmation_expires_at: string | null } | null;
};

export type TenantRentalRequestDetail = TenantRentalRequest & {
  contact_name: string;
  contact_phone: string;
  message: string;
};

export type TenantRentalRequestList = {
  items: TenantRentalRequest[];
  counts: Record<RentalRequestFilter, number>;
  page: number;
  last_page: number;
};

export type OwnerRentalRequest = Pick<TenantRentalRequest,
  "id" | "title" | "desired_move_in_date" | "desired_end_date" | "preferred_unit" |
  "status" | "outcome_reason" | "created_at" | "closed_at"
> & {
  contact_name: string;
  contact_phone: string;
};

export type OwnerRentalRequestDetail = OwnerRentalRequest & {
  message: string;
  updated_at: string;
  preferred_unit_available: boolean | null;
  alternative_units: { id: string; label: string; monthly_rent: string }[];
};

export type OwnerRentalRequestList = {
  items: OwnerRentalRequest[];
  counts: Record<RentalRequestStatus, number>;
  page: number;
  last_page: number;
};

const tenantRequestsPath = "/api/v1/tenant/rental-requests";

export function getTenantRentalRequests(filter: RentalRequestFilter, page: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ filter, page: String(page) });
  return request<TenantRentalRequestList>(`${tenantRequestsPath}?${query}`, { signal });
}

export function getTenantRentalRequest(id: string, signal?: AbortSignal) {
  return request<TenantRentalRequestDetail>(`${tenantRequestsPath}/${encodeURIComponent(id)}`, { signal });
}

export function withdrawTenantRentalRequest(id: string, input: { expected_updated_at: string; client_operation_id: string; reason: string }) {
  return request<void>(`${tenantRequestsPath}/${encodeURIComponent(id)}/withdraw`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

const ownerRequestsPath = "/api/v1/owner/rental-requests";

export function getOwnerRentalRequests(status: RentalRequestStatus, page: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ status, page: String(page) });
  return request<OwnerRentalRequestList>(`${ownerRequestsPath}?${query}`, { signal });
}

export function getOwnerRentalRequest(id: string, signal?: AbortSignal) {
  return request<OwnerRentalRequestDetail>(`${ownerRequestsPath}/${encodeURIComponent(id)}`, { signal });
}

export function rejectOwnerRentalRequest(id: string, input: { expected_updated_at: string; client_operation_id: string; reason: string }) {
  return request<void>(`${ownerRequestsPath}/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
