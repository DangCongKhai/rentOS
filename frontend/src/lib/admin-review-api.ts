import { ApiError, csrfToken, initializeCsrf } from "./auth-api";
import type { ReviewPackage } from "./admin-review-package";

export const adminPreviewMode = process.env.NEXT_PUBLIC_ADMIN_DATA_MODE === "preview";
const origin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type AdminListingSummary = {
  id: string; title: string; moderation_status: string; publication_status: string;
  submitted_at: string; owner: { id: string; name: string; email: string };
  property: { id: string; name: string }; units_count: number; photos_count: number;
};
export type AdminAudit = { id: string; action: string; actor_name: string | null; reason: string | null; created_at: string };
export type AdminMedia = { id: string; unit_id: string | null; caption: string | null; sort_order: number; mime_type: string; size_bytes: number; url: string };
export type AdminPackageDto = {
  id: string; title: string; description: string; moderation_status: string; publication_status: string;
  submitted_at: string; submitted_revision: number; submitted_content_revision: number;
  approved_content_revision: number | null; reviewed_at: string | null; review_reason: string | null;
  reviewer: { id: string; name: string } | null; snapshot_token: string;
  property: { id: string; name: string; address_line: string | null; ward: string | null; district: string | null; city: string | null; description: string | null; content_revision: number; shared_amenities: unknown; policies: unknown; archived_at: string | null };
  owner: { id: string; name: string; email: string; other_listings_count: number };
  units: { id: string; label: string; unit_kind: string; description: string | null; floor: string | null; area_m2: string | null; bedrooms: number; bathrooms: string; bathroom_arrangement: string; amenities: unknown; advertised_monthly_rent: string | null; deposit: string | null; minimum_rental_months: number; max_occupants: number | null; operational_status: string; policy_overrides: unknown }[];
  media: AdminMedia[]; cover_media_id: string | null; audit: AdminAudit[];
  completeness: { address: boolean; shared_cover: boolean; unit_photos_terms: boolean; policies: boolean; complete: boolean };
};
export type AdminQueueResponse = { data: AdminListingSummary[]; meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null } };
export type AdminDashboard = {
  pending_count: number; oldest_submitted_at: string | null; open_reports_count: number; suspended_count: number;
  waiting: AdminListingSummary[];
  activities: (AdminAudit & { title: string | null; listing_id: string | null })[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  const mutation = options.method === "POST";
  if (mutation) {
    let token = csrfToken();
    if (!token) { await initializeCsrf(); token = csrfToken(); }
    if (!token) throw new ApiError(419, "Phiên bảo mật đã hết hạn. Hãy khởi tạo lại phiên rồi gửi lại.");
    headers.set("X-XSRF-TOKEN", token);
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${origin}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, payload.message ?? "Không thể tải dữ liệu quản trị. Vui lòng thử lại.", payload.errors ?? {});
  return payload as T;
}

export async function getAdminDashboard(signal?: AbortSignal): Promise<AdminDashboard> {
  return (await request<{ data: AdminDashboard }>("/api/v1/admin/dashboard", { signal })).data;
}
export async function getAdminQueue(query: string, page: number, perPage: number, signal?: AbortSignal): Promise<AdminQueueResponse> {
  const params = new URLSearchParams({ q: query, page: String(page), per_page: String(perPage) });
  return request<AdminQueueResponse>(`/api/v1/admin/listing-reviews?${params}`, { signal });
}
export async function getAdminPackage(id: string, signal?: AbortSignal): Promise<AdminPackageDto> {
  return (await request<{ data: AdminPackageDto }>(`/api/v1/admin/listing-reviews/${encodeURIComponent(id)}`, { signal })).data;
}
export async function decideAdminPackage(id: string, action: "APPROVED" | "REJECTED", snapshot: string, operationId: string, reason: string): Promise<AdminPackageDto> {
  return (await request<{ data: AdminPackageDto }>(`/api/v1/admin/listing-reviews/${encodeURIComponent(id)}/${action === "APPROVED" ? "approve" : "reject"}`, {
    method: "POST", body: JSON.stringify({ expected_snapshot: snapshot, client_operation_id: operationId, ...(action === "REJECTED" ? { reason: reason.trim() } : {}) }),
  })).data;
}
export function adminMediaUrl(path: string): string { return new URL(path, `${origin}/`).toString(); }

export function waitingLabel(submittedAt: string | null): string {
  if (!submittedAt) return "Chưa gửi duyệt";
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(submittedAt)) / 3600000));
  return hours >= 24 ? `${Math.floor(hours / 24)} ngày ${hours % 24} giờ` : hours ? `${hours} giờ` : "Dưới 1 giờ";
}

function displayValues(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const source = value as Record<string, unknown>;
  const labels: Record<string, string> = { wifi: "Wi-Fi", parking: "Bãi để xe", shared_laundry: "Giặt chung", elevator: "Thang máy", air_conditioning: "Điều hòa", security_camera: "Camera an ninh", pets: "Thú cưng", smoking: "Hút thuốc", quiet_hours: "Giờ yên tĩnh" };
  const result: string[] = [];
  const standards = source.standard;
  if (standards && typeof standards === "object") for (const [key, item] of Object.entries(standards)) {
    if (item && typeof item === "object" && (item as Record<string, unknown>).enabled === true) result.push(labels[key] ?? key.replace(/_/g, " "));
  }
  for (const key of ["custom", "shared_rules", "additional_rules"]) if (Array.isArray(source[key])) result.push(...source[key].filter((item): item is string => typeof item === "string"));
  const defaults = source.defaults;
  if (defaults && typeof defaults === "object") for (const [key, item] of Object.entries(defaults)) {
    if (typeof item === "string" || typeof item === "boolean") result.push(`${labels[key] ?? key}: ${item === "NOT_ALLOWED" || item === false ? "Không cho phép" : item === "ALLOWED" || item === true ? "Cho phép" : item}`);
  }
  for (const key of ["pets", "smoking"]) {
    const item = source[key];
    if (typeof item === "string") result.push(`${labels[key]}: ${item === "NOT_ALLOWED" ? "Không cho phép" : item === "ALLOWED" ? "Cho phép" : item === "NEGOTIABLE" ? "Thỏa thuận" : item}`);
  }
  return result;
}

export function adaptAdminPackage(data: AdminPackageDto): ReviewPackage {
  const cover = data.media.find((item) => item.id === data.cover_media_id);
  return {
    id: data.id, title: data.title, description: data.description, status: data.moderation_status as "PENDING" | "APPROVED" | "REJECTED",
    initialApprovedAt: data.moderation_status === "APPROVED" ? data.reviewed_at : null,
    property: data.property.name, owner: data.owner.name, photos: data.media.length,
    submittedAt: data.submitted_at, waiting: waitingLabel(data.submitted_at),
    submittedVersion: data.submitted_revision, listingVersion: data.submitted_revision,
    propertyVersion: data.property.content_revision,
    address: [data.property.address_line, data.property.ward, data.property.district, data.property.city].filter(Boolean).join(", "),
    amenities: displayValues(data.property.shared_amenities), policies: displayValues(data.property.policies),
    cover: cover?.caption ?? "Ảnh bìa", email: data.owner.email, otherListings: data.owner.other_listings_count,
    units: data.units.map((unit) => ({ code: unit.label, area: Number(unit.area_m2 ?? 0), occupants: unit.max_occupants ?? 0, rent: Number(unit.advertised_monthly_rent ?? 0), deposit: Number(unit.deposit ?? 0), minimumMonths: unit.minimum_rental_months, note: [unit.floor ? `Tầng ${unit.floor}` : null, ...displayValues(unit.policy_overrides)].filter(Boolean).join(" · "), bathroom: unit.bathroom_arrangement === "PRIVATE" ? "Phòng tắm riêng" : "Phòng tắm dùng chung" })),
    gallery: data.media.map((item) => item.caption ?? "Ảnh được chọn"), apiData: data,
  };
}
