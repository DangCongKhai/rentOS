import { request } from "./auth-api";

export type ReasonCode = "FRAUD" | "MISLEADING" | "HARMFUL" | "OTHER";
export type ReportStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";

export type ReporterListingReport = {
  id: string;
  listing_id: string;
  listing_title?: string | null;
  reason_code: ReasonCode;
  description: string;
  status: ReportStatus;
  resolution_summary?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
};

export type AdminListingReport = {
  id: string;
  listing_id: string;
  listing: {
    id: string;
    title: string;
    publication_status: string;
    moderation_status: string;
    is_suspended: boolean;
    admin_suspended_at?: string | null;
    suspension_reason?: string | null;
    property_id?: string;
    owner?: {
      id?: string;
      name?: string;
      email?: string;
    };
  };
  reporter: {
    id: string;
    name: string;
    email: string;
  };
  reason_code: ReasonCode;
  description: string;
  status: ReportStatus;
  resolution_summary?: string | null;
  internal_notes?: string | null;
  reviewer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

export async function submitListingReport(
  listingId: string,
  input: {
    reason_code: ReasonCode | string;
    description: string;
    client_operation_id?: string;
  }
): Promise<{ message: string; data: ReporterListingReport }> {
  return request<{ message: string; data: ReporterListingReport }>(`/api/v1/listings/${listingId}/reports`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getTenantReports(page = 1, perPage = 15): Promise<PaginatedResponse<ReporterListingReport>> {
  return request<PaginatedResponse<ReporterListingReport>>(`/api/v1/tenant/reports?page=${page}&per_page=${perPage}`);
}

export async function getTenantReport(reportId: string): Promise<ReporterListingReport> {
  return request<ReporterListingReport>(`/api/v1/tenant/reports/${reportId}`);
}

export const adminPreviewMode = process.env.NEXT_PUBLIC_ADMIN_DATA_MODE === "preview";

const mockAdminReports: AdminListingReport[] = [
  {
    id: "preview-report-1",
    listing_id: "listing-mock-1",
    listing: {
      id: "listing-mock-1",
      title: "Căn hộ studio full nội thất gần biển Mỹ Khê",
      publication_status: "PUBLISHED",
      moderation_status: "APPROVED",
      is_suspended: false,
      admin_suspended_at: null,
      suspension_reason: null,
      owner: {
        id: "owner-1",
        name: "Linh",
        email: "owner.rnt04.1@rentos.test",
      },
    },
    reporter: {
      id: "reporter-1",
      name: "Lan Chi Dang",
      email: "tenant1@example.com",
    },
    reason_code: "MISLEADING",
    description: "Ảnh chụp trên tin đăng không giống với phòng thực tế khi đi xem.",
    status: "OPEN",
    resolution_summary: null,
    internal_notes: null,
    reviewer: null,
    reviewed_at: null,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "preview-report-2",
    listing_id: "listing-mock-2",
    listing: {
      id: "listing-mock-2",
      title: "Phòng trọ khép kín gần ĐH Bách khoa",
      publication_status: "PUBLISHED",
      moderation_status: "APPROVED",
      is_suspended: false,
      admin_suspended_at: null,
      suspension_reason: null,
      owner: {
        id: "owner-2",
        name: "Hòa",
        email: "owner.rnt04.2@rentos.test",
      },
    },
    reporter: {
      id: "reporter-2",
      name: "Hoang Nam Bui",
      email: "tenant2@example.com",
    },
    reason_code: "FRAUD",
    description: "Yêu cầu đặt cọc trước qua Zalo trước khi cho xem phòng.",
    status: "REVIEWING",
    resolution_summary: null,
    internal_notes: "Đang liên hệ với chủ nhà để xác minh số điện thoại.",
    reviewer: {
      id: "admin-1",
      name: "Trần Minh",
      email: "admin.rnt04@rentos.test",
    },
    reviewed_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

export async function getAdminListingReports(params: {
  status?: string;
  reason_code?: string;
  search?: string;
  page?: number;
  per_page?: number;
} = {}): Promise<PaginatedResponse<AdminListingReport>> {
  if (adminPreviewMode) {
    let filtered = [...mockAdminReports];
    if (params.status) filtered = filtered.filter((r) => r.status === params.status);
    if (params.reason_code) filtered = filtered.filter((r) => r.reason_code === params.reason_code);
    if (params.search) {
      const s = params.search.toLowerCase();
      filtered = filtered.filter((r) => (r.listing?.title?.toLowerCase().includes(s) || r.reporter.name.toLowerCase().includes(s)));
    }
    return {
      data: filtered,
      meta: {
        current_page: 1,
        per_page: 15,
        total: filtered.length,
        last_page: 1,
      },
    };
  }

  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.reason_code) query.set("reason_code", params.reason_code);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  const qs = query.toString();
  return request<PaginatedResponse<AdminListingReport>>(`/api/v1/admin/listing-reports${qs ? `?${qs}` : ""}`);
}

export async function getAdminListingReport(reportId: string): Promise<AdminListingReport> {
  if (adminPreviewMode) {
    const found = mockAdminReports.find((r) => r.id === reportId) ?? mockAdminReports[0];
    return found;
  }
  return request<AdminListingReport>(`/api/v1/admin/listing-reports/${reportId}`);
}

export async function startAdminReportReview(reportId: string): Promise<{ message: string; data: AdminListingReport }> {
  if (adminPreviewMode) {
    const report = mockAdminReports.find((r) => r.id === reportId) ?? mockAdminReports[0];
    report.status = "REVIEWING";
    report.reviewed_at = new Date().toISOString();
    return { message: "Đã tiếp nhận điều tra báo cáo thành công.", data: report };
  }
  return request<{ message: string; data: AdminListingReport }>(`/api/v1/admin/listing-reports/${reportId}/start-review`, {
    method: "POST",
    body: "{}",
  });
}

export async function resolveAdminReport(
  reportId: string,
  input: {
    resolution_summary: string;
    internal_notes?: string;
    suspend_listing?: boolean;
    suspension_reason?: string;
  }
): Promise<{ message: string; data: AdminListingReport }> {
  if (adminPreviewMode) {
    const report = mockAdminReports.find((r) => r.id === reportId) ?? mockAdminReports[0];
    report.status = "RESOLVED";
    report.resolution_summary = input.resolution_summary;
    if (input.internal_notes) report.internal_notes = input.internal_notes;
    if (input.suspend_listing && report.listing) {
      report.listing.is_suspended = true;
      report.listing.suspension_reason = input.suspension_reason ?? null;
      report.listing.admin_suspended_at = new Date().toISOString();
    }
    return { message: "Báo cáo đã được giải quyết thành công.", data: report };
  }
  return request<{ message: string; data: AdminListingReport }>(`/api/v1/admin/listing-reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function dismissAdminReport(
  reportId: string,
  input: {
    resolution_summary: string;
    internal_notes?: string;
  }
): Promise<{ message: string; data: AdminListingReport }> {
  if (adminPreviewMode) {
    const report = mockAdminReports.find((r) => r.id === reportId) ?? mockAdminReports[0];
    report.status = "DISMISSED";
    report.resolution_summary = input.resolution_summary;
    if (input.internal_notes) report.internal_notes = input.internal_notes;
    return { message: "Báo cáo đã được bác bỏ thành công.", data: report };
  }
  return request<{ message: string; data: AdminListingReport }>(`/api/v1/admin/listing-reports/${reportId}/dismiss`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function suspendAdminListing(
  listingId: string,
  reason: string
): Promise<{ message: string; data: { id: string; is_suspended: boolean; suspension_reason: string } }> {
  if (adminPreviewMode) {
    const report = mockAdminReports.find((r) => r.listing_id === listingId);
    if (report?.listing) {
      report.listing.is_suspended = true;
      report.listing.suspension_reason = reason;
      report.listing.admin_suspended_at = new Date().toISOString();
    }
    return { message: "Tin đăng đã được đình chỉ thành công.", data: { id: listingId, is_suspended: true, suspension_reason: reason } };
  }
  return request<{ message: string; data: { id: string; is_suspended: boolean; suspension_reason: string } }>(
    `/api/v1/admin/listings/${listingId}/suspend`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  );
}

export async function restoreAdminListing(
  listingId: string,
  reason: string
): Promise<{ message: string; data: { id: string; is_suspended: boolean } }> {
  if (adminPreviewMode) {
    const report = mockAdminReports.find((r) => r.listing_id === listingId);
    if (report?.listing) {
      report.listing.is_suspended = false;
      report.listing.suspension_reason = null;
      report.listing.admin_suspended_at = null;
    }
    return { message: "Tin đăng đã được khôi phục thành công.", data: { id: listingId, is_suspended: false } };
  }
  return request<{ message: string; data: { id: string; is_suspended: boolean } }>(
    `/api/v1/admin/listings/${listingId}/restore`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  );
}

