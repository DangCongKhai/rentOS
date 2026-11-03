"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/auth-api";
import { adminPreviewMode, getAdminDashboard, type AdminDashboard } from "@/lib/admin-review-api";

type AdminApiContext = { dashboard: AdminDashboard | null; revision: number; refresh: () => void };
const Context = createContext<AdminApiContext>({ dashboard: null, revision: 0, refresh: () => {} });
export function useAdminApi() { return useContext(Context); }

export function AdminApiProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ accountId: string; data: AdminDashboard | null; error: Error | null } | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (adminPreviewMode || status !== "authenticated" || !user) return;
    const controller = new AbortController();
    const accountId = user.id;
    getAdminDashboard(controller.signal).then((data) => { if (!controller.signal.aborted) setState({ accountId, data, error: null }); }).catch((error) => {
      if (!controller.signal.aborted) setState({ accountId, data: null, error });
    });
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [user, status, revision, refresh]);
  const current = state?.accountId === user?.id ? state : null;
  if (adminPreviewMode) return <Context.Provider value={{ dashboard: null, revision, refresh }}>{children}</Context.Provider>;
  if (status === "loading" || (status === "authenticated" && !current)) return <main className="admin-reviewLoading" role="status">Đang kiểm tra quyền quản trị…</main>;
  const error = current?.error;
  if (status !== "authenticated" || error || !current?.data) {
    const permission = error instanceof ApiError && error.status === 403;
    return <main className="admin-queueEmpty"><h1>{permission ? "Bạn không có quyền truy cập quản trị" : status === "guest" || (error instanceof ApiError && error.status === 401) ? "Vui lòng đăng nhập để tiếp tục" : "Không thể tải dữ liệu quản trị"}</h1><p>{permission ? "Chỉ tài khoản admin đang hoạt động và đã xác minh email mới được truy cập." : "Phiên đăng nhập hoặc kết nối API chưa sẵn sàng."}</p><Link href="/login" className="admin-queueClear">Đăng nhập</Link> <Link href="/" className="admin-queueClear">Về trang chủ</Link>{status === "authenticated" && <button type="button" className="admin-queueClear" onClick={refresh}>Thử lại</button>}</main>;
  }
  return <Context.Provider value={{ dashboard: current.data, revision, refresh }}>{children}</Context.Provider>;
}
