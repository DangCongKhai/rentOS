const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  errors: FieldErrors;

  constructor(status: number, message: string, errors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  phone: string | null;
  is_admin: boolean;
};

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
  document_sha256: string;
  signed_on: string | null;
  created_at: string;
  owner_confirmed_at: string | null;
  tenant_confirmed_at: string | null;
  tenant_rejected_at: string | null;
  tenant_rejection_reason: string | null;
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
  pending_contract: TenancyContractRecord | null;
  current_agreement: TenancyContractRecord | null;
  upcoming_agreements: TenancyContractRecord[];
  events: Array<{
    action: string;
    reason: string | null;
    created_at: string;
  }>;
};

export type TenancyContractDownload = {
  contract_id: string;
  version_number: number;
  url: string;
  expires_in: number;
};

export type TenancyDecisionResult = {
  tenancy_id: string;
  status: string;
  contract_id: string;
  version_number: number;
  document_sha256: string;
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

export type OwnerProperty = {
  id: string;
  owner_id: string;
  client_operation_id: string;
  name: string;
  property_type: string;
  rental_arrangement: string;
  city: string | null;
  policies?: unknown;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerPropertyDetail = OwnerProperty & {
  address_line: string | null;
  ward: string | null;
  description: string | null;
  content_revision: number;
  property_type: string;
  rental_arrangement: string;
  shared_amenities: AmenityDocument;
  policies: PropertyPolicies;
  units: OwnerUnit[];
};

export type OwnerPropertyMedia = {
  id: string;
  property_id: string;
  unit_id: string | null;
  caption: string | null;
  sort_order: number;
  is_selected_for_listing: boolean;
  revision: number;
  mime_type: string;
  size_bytes: number;
  preview_url: string | null;
  assigned_unit_ids?: string[];
};

export type OwnerListing = {
  id: string;
  property_id: string;
  client_operation_id: string;
  title: string;
  description: string;
  cover_media_id: string | null;
  moderation_status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  publication_status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  submitted_revision: number | null;
  submitted_content_revision: number | null;
  approved_content_revision: number | null;
  review_reason: string | null;
  admin_suspended_at: string | null;
  archived_at: string | null;
  property_content_revision: number;
};

export type AmenityDocument = {
  schema_version: number;
  standard: Record<string, { enabled: boolean; details?: string | null }>;
  custom: string[];
};

export type PropertyPolicies = {
  schema_version: number;
  pets: string;
  smoking: string;
  shared_rules: string[];
};

export type OwnerUnit = {
  id: string;
  property_id: string;
  label: string;
  unit_kind: string;
  description: string | null;
  floor: string | null;
  area_m2: string | number | null;
  bedrooms: number;
  bathrooms: string | number;
  bathroom_arrangement: string;
  amenities: AmenityDocument;
  advertised_monthly_rent: string | number | null;
  deposit: string | number | null;
  minimum_rental_months: number;
  max_occupants: number | null;
  operational_status: "READY" | "MAINTENANCE" | "RETIRED";
  is_marketed: boolean;
  policy_overrides: {
    pets?: string;
    smoking?: string;
    additional_rules?: string[];
  };
  archived_at: string | null;
};

export type AmenityCatalogEntry = {
  key: string;
  label: string;
  label_vi?: string;
  scopes: string[];
};

export function csrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice("XSRF-TOKEN=".length));
  } catch {
    return cookie.slice("XSRF-TOKEN=".length);
  }
}

export async function initializeCsrf(): Promise<void> {
  const response = await fetch(`${apiUrl}/sanctum/csrf-cookie`, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "Không thể khởi tạo phiên bảo mật. Vui lòng thử lại.",
    );
  }
}

async function ensureCsrfToken(): Promise<string> {
  let token = csrfToken();
  if (!token) {
    await initializeCsrf();
    token = csrfToken();
  }
  if (!token) {
    throw new ApiError(
      419,
      "Phiên bảo mật đã hết hạn. Vui lòng tải lại trang.",
    );
  }
  return token;
}

async function executeFetch(
  path: string,
  method: string,
  headers: Headers,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const isWriteMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isWriteMethod) {
    const token = await ensureCsrfToken();
    headers.set("X-XSRF-TOKEN", token);
  }

  let response = await executeFetch(path, method, headers, init);
  console.log("response: ", response);
  // Nếu gặp lỗi 419 (CSRF token mismatch), xin lại csrf-cookie một lần và thử lại đúng request đó 1 lần
  if (response.status === 419 && isWriteMethod) {
    await initializeCsrf();
    const refreshedToken = csrfToken();
    if (refreshedToken) {
      headers.set("X-XSRF-TOKEN", refreshedToken);
      response = await executeFetch(path, method, headers, init);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    errors?: FieldErrors;
    data?: T;
    two_factor?: boolean;
  };

  if (!response.ok) {
    const defaultMessage =
      response.status === 401
        ? "Thông tin đăng nhập không đúng hoặc phiên đã hết hạn."
        : response.status === 419
          ? "Phiên bảo mật đã hết hạn. Vui lòng thử lại."
          : response.status === 429
            ? "Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại."
            : "Có lỗi xảy ra. Vui lòng kiểm tra thông tin và thử lại.";

    throw new ApiError(
      response.status,
      payload.message ?? defaultMessage,
      payload.errors ?? {},
    );
  }

  return (payload.data ?? payload) as T;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await request<void>("/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<void> {
  await request<void>("/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await request<void>("/logout", { method: "POST", body: "{}" });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>("/api/v1/me");
}

export async function updateProfile(input: {
  name: string;
  phone: string | null;
}): Promise<CurrentUser> {
  return request<CurrentUser>("/api/v1/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updatePassword(input: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await request<void>("/user/password", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function resendVerification(): Promise<void> {
  await request<void>("/email/verification-notification", {
    method: "POST",
    body: "{}",
  });
}

export async function forgotPassword(input: {
  email: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resetPassword(input: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

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

export async function getOwnerTenancyContractDownload(
  tenancyId: string,
  contractId: string,
): Promise<TenancyContractDownload> {
  return request<TenancyContractDownload>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/contracts/${encodeURIComponent(contractId)}/download`,
  );
}

export async function getTenantTenancyContractDownload(
  tenancyId: string,
  contractId: string,
): Promise<TenancyContractDownload> {
  return request<TenancyContractDownload>(
    `/api/v1/tenant/tenancies/${encodeURIComponent(tenancyId)}/contracts/${encodeURIComponent(contractId)}/download`,
  );
}

export async function confirmTenantTenancyContract(
  tenancyId: string,
  contractId: string,
  input: { client_operation_id: string; document_sha256: string },
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
    document_sha256: string;
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

export async function getOwnerRentalRequests(): Promise<
  OwnerRentalRequestSummary[]
> {
  return request<OwnerRentalRequestSummary[]>("/api/v1/owner/rental-requests");
}

export async function getOwnerRentalRequest(
  rentalRequestId: string,
): Promise<OwnerRentalRequestDetail> {
  return request<OwnerRentalRequestDetail>(
    `/api/v1/owner/rental-requests/${encodeURIComponent(rentalRequestId)}`,
  );
}

export async function getOwnerProperties(
  includeArchived = false,
): Promise<OwnerProperty[]> {
  const query = includeArchived ? "?include_archived=1" : "";
  const result = await request<OwnerProperty[] | { data: OwnerProperty[] }>(
    `/api/v1/owner/properties${query}`,
  );
  return Array.isArray(result) ? result : result.data;
}

export async function getAmenityCatalog(): Promise<AmenityCatalogEntry[]> {
  return request<AmenityCatalogEntry[]>("/api/v1/owner/amenities");
}

export async function getOwnerProperty(
  propertyId: string,
): Promise<OwnerPropertyDetail> {
  const property = await request<OwnerPropertyDetail>(
    `/api/v1/owner/properties/${propertyId}`,
  );
  return {
    ...property,
    units: Array.isArray(property.units) ? property.units : [],
  };
}

export async function getOwnerPropertyMedia(
  propertyId: string,
): Promise<OwnerPropertyMedia[]> {
  return request<OwnerPropertyMedia[]>(
    `/api/v1/owner/properties/${propertyId}/media`,
  );
}

export async function getOwnerListingById(
  listingId: string,
): Promise<OwnerListing> {
  return request<OwnerListing>(`/api/v1/owner/listings/${listingId}`);
}

export async function getOwnerListing(
  propertyId: string,
): Promise<OwnerListing | null> {
  try {
    return await request<OwnerListing>(
      `/api/v1/owner/properties/${propertyId}/listing`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createOwnerListing(
  propertyId: string,
  input: {
    client_operation_id: string;
    title: string;
    description: string;
    cover_media_id: string | null;
  },
): Promise<OwnerListing> {
  return request<OwnerListing>(
    `/api/v1/owner/properties/${propertyId}/listing`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateOwnerListing(
  propertyId: string,
  input: {
    expected_content_revision: number;
    title: string;
    description: string;
    cover_media_id: string | null;
  },
): Promise<OwnerListing> {
  return request<OwnerListing>(
    `/api/v1/owner/properties/${propertyId}/listing`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

async function listingAction(
  propertyId: string,
  action: "submit" | "publish" | "hide" | "archive",
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return request<OwnerListing>(
    `/api/v1/owner/properties/${propertyId}/listing/${action}`,
    {
      method: "POST",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
      }),
    },
  );
}

export async function submitOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "submit", expectedContentRevision);
}

export async function publishOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "publish", expectedContentRevision);
}

export async function hideOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "hide", expectedContentRevision);
}

export async function archiveOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "archive", expectedContentRevision);
}

export async function createOwnerProperty(
  input: Record<string, unknown>,
): Promise<OwnerPropertyDetail> {
  return request<OwnerPropertyDetail>("/api/v1/owner/properties", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOwnerProperty(
  propertyId: string,
  input: Record<string, unknown>,
): Promise<OwnerPropertyDetail> {
  return request<OwnerPropertyDetail>(
    `/api/v1/owner/properties/${propertyId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function archiveOwnerProperty(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerPropertyDetail> {
  return request<OwnerPropertyDetail>(
    `/api/v1/owner/properties/${propertyId}/archive`,
    {
      method: "PATCH",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
      }),
    },
  );
}

export async function createOwnerUnit(
  propertyId: string,
  input: Record<string, unknown>,
): Promise<OwnerUnit> {
  return request<OwnerUnit>(`/api/v1/owner/properties/${propertyId}/units`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOwnerUnit(
  propertyId: string,
  unitId: string,
  input: Record<string, unknown>,
): Promise<OwnerUnit> {
  return request<OwnerUnit>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function archiveOwnerUnit(
  propertyId: string,
  unitId: string,
  expectedContentRevision: number,
): Promise<OwnerUnit> {
  return request<OwnerUnit>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}/archive`,
    {
      method: "PATCH",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
      }),
    },
  );
}

export async function createOwnerUnitBatch(
  propertyId: string,
  input: Record<string, unknown>,
): Promise<OwnerUnit[]> {
  return request<OwnerUnit[]>(
    `/api/v1/owner/properties/${propertyId}/units/bulk`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function uploadOwnerMedia(
  propertyId: string,
  input: {
    file: File;
    client_operation_id: string;
    expected_content_revision: number;
    unit_id?: string;
    caption?: string;
  },
): Promise<{ media: OwnerPropertyMedia; content_revision: number }> {
  const body = new FormData();
  body.set("photo", input.file);
  body.set("client_operation_id", input.client_operation_id);
  body.set(
    "expected_content_revision",
    String(input.expected_content_revision),
  );
  if (input.unit_id) body.set("unit_id", input.unit_id);
  if (input.caption) body.set("caption", input.caption);
  return request<{ media: OwnerPropertyMedia; content_revision: number }>(
    `/api/v1/owner/properties/${propertyId}/media`,
    { method: "POST", body },
  );
}

export async function updateOwnerGallery(
  propertyId: string,
  input: {
    expected_content_revision: number;
    items: Array<{
      media_id: string;
      revision: number;
      sort_order: number;
      is_selected_for_listing: boolean;
    }>;
  },
): Promise<OwnerPropertyMedia[]> {
  return request<OwnerPropertyMedia[]>(
    `/api/v1/owner/properties/${propertyId}/gallery`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function saveOwnerUnitSharedMedia(
  propertyId: string,
  unitId: string,
  input: {
    expected_content_revision: number;
    media_ids: string[];
  },
): Promise<{ content_revision: number }> {
  return request<{ content_revision: number }>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}/shared-media`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function updateOwnerUnitGallery(
  propertyId: string,
  unitId: string,
  input: {
    expected_content_revision: number;
    items: Array<{
      media_id: string;
      revision: number;
      sort_order: number;
      is_selected_for_listing: boolean;
    }>;
  },
): Promise<OwnerPropertyMedia[]> {
  return request<OwnerPropertyMedia[]>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}/gallery`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function removeOwnerMedia(
  propertyId: string,
  mediaId: string,
  expectedContentRevision: number,
  revision: number,
): Promise<OwnerPropertyMedia> {
  return request<OwnerPropertyMedia>(
    `/api/v1/owner/properties/${propertyId}/media/${mediaId}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
        revision,
      }),
    },
  );
}

export type OwnerRentalRequestSummary = {
  id: string;
  status: string;
  desired_move_in_date: string;
  desired_end_date: string;
  message: string;
  contact_name: string;
  contact_phone: string;
  created_at: string;
  closed_at: string | null;
  outcome_reason: string | null;
  listing_title: string;
  property_name: string;
  city: string | null;
  preferred_unit_label: string | null;
  tenancy_id: string | null;
};

export type OwnerProposalUnit = {
  id: string;
  label: string;
  operational_status: "READY" | "MAINTENANCE" | "RETIRED";
  monthly_rent: number | string | null;
  deposit_amount: number | string | null;
  minimum_rental_months: number;
  policy_overrides: OwnerUnit["policy_overrides"];
  has_date_conflict: boolean;
};

export type OwnerRentalRequestDetail = {
  request: OwnerRentalRequestSummary & {
    preferred_unit_id: string | null;
    listing_id: string;
    property_id: string;
    policies: PropertyPolicies | string;
  };
  property_policies: PropertyPolicies;
  units: OwnerProposalUnit[];
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
    document_sha256: string;
  };
  replayed: boolean;
};

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
    agreement_document: File;
  },
): Promise<OwnerTenancyProposalResult> {
  const body = new FormData();

  body.append("client_operation_id", input.client_operation_id);
  body.append("unit_id", input.unit_id);
  body.append("start_date", input.start_date);
  body.append("end_date", input.end_date);
  body.append("monthly_rent", String(input.monthly_rent));
  body.append("deposit_amount", String(input.deposit_amount));
  body.append("policies_snapshot", JSON.stringify(input.policies_snapshot));
  body.append("agreement_document", input.agreement_document);

  return request<OwnerTenancyProposalResult>(
    `/api/v1/owner/rental-requests/${encodeURIComponent(rentalRequestId)}/proposal`,
    { method: "POST", body },
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
    agreement_document: File;
    signed_on?: string | null;
  },
): Promise<OwnerTenancyProposalResult> {
  const body = new FormData();

  body.append("client_operation_id", input.client_operation_id);
  body.append("supersedes_contract_id", input.supersedes_contract_id);
  body.append("start_date", input.start_date);
  body.append("end_date", input.end_date);
  body.append("monthly_rent", String(input.monthly_rent));
  body.append("deposit_amount", String(input.deposit_amount));
  body.append("policies_snapshot", JSON.stringify(input.policies_snapshot));
  body.append("agreement_document", input.agreement_document);

  if (input.signed_on) {
    body.append("signed_on", input.signed_on);
  }

  return request<OwnerTenancyProposalResult>(
    `/api/v1/owner/tenancies/${encodeURIComponent(tenancyId)}/correction`,
    { method: "POST", body },
  );
}
