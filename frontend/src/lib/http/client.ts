import { localizeApiMessage, localizeFieldErrors } from "./localize";
import type { FieldErrors } from "./localize";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");
type ApiDocument = {
  message?: string;
  errors?: FieldErrors;
  data?: unknown;
  meta?: unknown;
};
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
async function requestDocument(
  path: string,
  init: RequestInit = {},
): Promise<ApiDocument | undefined> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  )
    headers.set("Content-Type", "application/json");
  const isWriteMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isWriteMethod) headers.set("X-XSRF-TOKEN", await ensureCsrfToken());
  let response = await executeFetch(path, method, headers, init);
  if (response.status === 419 && isWriteMethod) {
    await initializeCsrf();
    const refreshedToken = csrfToken();
    if (refreshedToken) {
      headers.set("X-XSRF-TOKEN", refreshedToken);
      response = await executeFetch(path, method, headers, init);
    }
  }
  if (response.status === 204) return undefined;
  const payload = (await response.json().catch(() => ({}))) as ApiDocument;
  if (!response.ok) {
    const fallback =
      response.status === 401
        ? "Thông tin đăng nhập không đúng hoặc phiên đã hết hạn."
        : response.status === 419
          ? "Phiên bảo mật đã hết hạn. Vui lòng thử lại."
          : response.status === 429
            ? "Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại."
            : "Có lỗi xảy ra. Vui lòng kiểm tra thông tin và thử lại.";
    throw new ApiError(
      response.status,
      localizeApiMessage(payload.message ?? fallback, response.status),
      localizeFieldErrors(payload.errors ?? {}),
    );
  }
  return payload;
}


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

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const payload = await requestDocument(path, init);
  if (payload === undefined) {
    return undefined as T;
  }

  // Preserve pagination envelope { data, meta } and mutation envelopes { message, data }
  if (payload && typeof payload === "object") {
    if ("meta" in payload && "data" in payload) {
      return payload as T;
    }
    if ("message" in payload && "data" in payload) {
      return payload as T;
    }
  }

  return ((payload as { data?: T }).data ?? payload) as T;
}
