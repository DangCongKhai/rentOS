"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adaptAdminPackage, getAdminPackage, type AdminPackageDto } from "@/lib/admin-review-api";
import { ApiError } from "@/lib/auth-api";
import { useAdminApi } from "./admin-api-provider";
import { AdminReviewDetail } from "./admin-review-detail";

export function AdminReviewLoader({ id }: { id: string }) {
  const { revision, refresh } = useAdminApi();
  const [retry, setRetry] = useState(0);
  const key = `${id}:${revision}:${retry}`;
  const [state, setState] = useState<{ key: string; data?: AdminPackageDto; error?: Error } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getAdminPackage(id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key, data });
    }).catch((error: Error) => {
      if (controller.signal.aborted) return;
      setState({ key, error });
      if (error instanceof ApiError && [401, 403].includes(error.status)) refresh();
    });
    return () => controller.abort();
  }, [id, key, refresh]);

  if (state?.key !== key) return <p className="admin-reviewLoading" role="status">Đang tải gói tin đăng…</p>;
  if (!state.data) return <section className="admin-queueEmpty" role="alert">
    <h1>{state.error instanceof ApiError && state.error.status === 404 ? "Không tìm thấy gói tin đăng" : "Không tải được gói tin đăng"}</h1>
    <p>Gói tin có thể đã được lưu trữ hoặc kết nối tạm thời bị gián đoạn.</p>
    <button type="button" className="admin-reviewSecondary" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>{" "}
    <Link href="/admin/review-queue">Về hàng đợi kiểm duyệt</Link>
  </section>;
  return <AdminReviewDetail reviewPackage={adaptAdminPackage(state.data)} onReload={() => setRetry((value) => value + 1)} onDecided={(data) => { setState({ key, data }); refresh(); }} />;
}
