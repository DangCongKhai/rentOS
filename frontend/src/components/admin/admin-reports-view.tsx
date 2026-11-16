"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/auth-api";
import {
  dismissAdminReport,
  getAdminListingReports,
  resolveAdminReport,
  restoreAdminListing,
  startAdminReportReview,
  suspendAdminListing,
  type AdminListingReport,
  type PaginationMeta,
  type ReportStatus,
} from "@/lib/reports-api";

const reasonLabels: Record<string, string> = {
  FRAUD: "Gian lận / Lừa đảo",
  MISLEADING: "Sai lệch thông tin",
  HARMFUL: "Nội dung độc hại",
  OTHER: "Lý do khác",
};

export function AdminReportsView() {
  const [reports, setReports] = useState<AdminListingReport[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isForbiddenOrNotFound, setIsForbiddenOrNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Detail & Action modal state
  const [selectedReport, setSelectedReport] = useState<AdminListingReport | null>(null);
  const [actionType, setActionType] = useState<"RESOLVE" | "DISMISS" | "SUSPEND" | "RESTORE" | null>(null);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [suspendListing, setSuspendListing] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [directReason, setDirectReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await getAdminListingReports({
          status: statusFilter || undefined,
          reason_code: reasonFilter || undefined,
          search: search.trim() || undefined,
          page,
          per_page: 15,
        });
        if (!ignore) {
          const list = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];
          setReports(list);
          setMeta(response && "meta" in response ? response.meta : null);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 403 || err.status === 401)) {
            setIsForbiddenOrNotFound(true);
          } else {
            setActionError("Không thể tải danh sách điều tra. Vui lòng thử lại sau.");
          }
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [statusFilter, reasonFilter, search, page, reloadKey]);

  // Non-disclosure compliance: Non-admins see identical 404 page
  if (isForbiddenOrNotFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center my-auto min-h-[50vh]">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-sm flex flex-col items-center">
          <span className="block text-4xl sm:text-5xl font-extrabold text-slate-300 mb-4 select-none">404</span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Không tìm thấy trang</h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di dời.
          </p>
          <Link
            className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors"
            href="/"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  function handleOpenAction(report: AdminListingReport, type: "RESOLVE" | "DISMISS" | "SUSPEND" | "RESTORE") {
    setSelectedReport(report);
    setActionType(type);
    setResolutionSummary("");
    setInternalNotes(report.internal_notes ?? "");
    setSuspendListing(false);
    setSuspensionReason("");
    setDirectReason("");
    setActionError(null);
    setActionSuccess(null);
  }

  async function handleStartReview(report: AdminListingReport) {
    setActionError(null);
    try {
      const res = await startAdminReportReview(report.id);
      setActionSuccess("Đã tiếp nhận điều tra báo cáo thành công.");
      setSelectedReport(res.data ?? (res as unknown as AdminListingReport));
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Lỗi khi tiếp nhận điều tra.");
      }
    }
  }

  async function handleExecuteAction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReport || !actionType) return;

    setSubmittingAction(true);
    setActionError(null);
    try {
      if (actionType === "RESOLVE") {
        if (!resolutionSummary.trim()) {
          setActionError("Vui lòng nhập tóm tắt kết quả xử lý gửi cho người báo cáo.");
          setSubmittingAction(false);
          return;
        }
        if (suspendListing && !suspensionReason.trim()) {
          setActionError("Vui lòng nhập lý do đình chỉ tin đăng.");
          setSubmittingAction(false);
          return;
        }
        const res = await resolveAdminReport(selectedReport.id, {
          resolution_summary: resolutionSummary.trim(),
          internal_notes: internalNotes.trim() || undefined,
          suspend_listing: suspendListing,
          suspension_reason: suspendListing ? suspensionReason.trim() : undefined,
        });
        setSelectedReport(res.data ?? (res as unknown as AdminListingReport));
        setActionSuccess("Báo cáo đã được giải quyết thành công.");
      } else if (actionType === "DISMISS") {
        if (!resolutionSummary.trim()) {
          setActionError("Vui lòng nhập lý do bác bỏ gửi cho người báo cáo.");
          setSubmittingAction(false);
          return;
        }
        const res = await dismissAdminReport(selectedReport.id, {
          resolution_summary: resolutionSummary.trim(),
          internal_notes: internalNotes.trim() || undefined,
        });
        setSelectedReport(res.data ?? (res as unknown as AdminListingReport));
        setActionSuccess("Báo cáo đã được bác bỏ thành công.");
      } else if (actionType === "SUSPEND") {
        if (!directReason.trim()) {
          setActionError("Vui lòng nhập lý do đình chỉ tin đăng.");
          setSubmittingAction(false);
          return;
        }
        await suspendAdminListing(selectedReport.listing_id, directReason.trim());
        setActionSuccess("Tin đăng đã được đình chỉ thành công.");
      } else if (actionType === "RESTORE") {
        if (!directReason.trim()) {
          setActionError("Vui lòng nhập lý do khôi phục tin đăng.");
          setSubmittingAction(false);
          return;
        }
        await restoreAdminListing(selectedReport.listing_id, directReason.trim());
        setActionSuccess("Tin đăng đã được khôi phục thành công.");
      }

      setActionType(null);
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Lỗi trong quá trình thực hiện hành động.");
      }
    } finally {
      setSubmittingAction(false);
    }
  }

  function renderStatusBadge(status: ReportStatus) {
    switch (status) {
      case "OPEN":
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">Chờ xử lý</span>;
      case "REVIEWING":
        return <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">Đang điều tra</span>;
      case "RESOLVED":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">Đã giải quyết</span>;
      case "DISMISSED":
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">Đã bác bỏ</span>;
    }
  }

  function formatDate(isoString?: string | null) {
    if (!isoString) return "--";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    } catch {
      return isoString;
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản trị Điều tra Báo cáo & Đình chỉ Tin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hàng đợi thẩm định vi phạm, xử lý khiếu nại và kiểm soát hiển thị tin đăng công khai.
          </p>
        </div>
      </div>

      {actionSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-4">✕</button>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex justify-between items-center">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800 font-bold ml-4">✕</button>
        </div>
      ) : null}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Tất cả", value: "" },
            { label: "Chờ xử lý (OPEN)", value: "OPEN" },
            { label: "Đang xem xét (REVIEWING)", value: "REVIEWING" },
            { label: "Đã giải quyết (RESOLVED)", value: "RESOLVED" },
            { label: "Đã bác bỏ (DISMISSED)", value: "DISMISSED" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${statusFilter === tab.value
                  ? "bg-[#3368a0] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="">Tất cả lý do</option>
            <option value="FRAUD">Gian lận / Lừa đảo</option>
            <option value="MISLEADING">Sai lệch thông tin</option>
            <option value="HARMFUL">Nội dung độc hại</option>
            <option value="OTHER">Lý do khác</option>
          </select>

          <input
            type="text"
            placeholder="Tìm theo tin đăng, người báo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Reports Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Tin đăng</th>
                <th className="px-4 py-3.5">Lý do vi phạm</th>
                <th className="px-4 py-3.5">Người gửi</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-4 py-3.5">Đình chỉ</th>
                <th className="px-4 py-3.5">Ngày gửi</th>
                <th className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Đang tải dữ liệu điều tra...
                  </td>
                </tr>
              ) : (reports?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Không có báo cáo nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                (reports ?? []).map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition cursor-pointer" onClick={() => setSelectedReport(report)}>
                    <td className="px-4 py-3.5 font-medium text-slate-900 max-w-xs truncate">
                      {report.listing?.title ?? report.listing_id}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium text-slate-700 bg-slate-100 rounded px-2 py-0.5">
                        {reasonLabels[report.reason_code] ?? report.reason_code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">{report.reporter?.name}</div>
                      <div className="text-slate-400">{report.reporter?.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      {renderStatusBadge(report.status)}
                    </td>
                    <td className="px-4 py-3.5">
                      {report.listing?.is_suspended ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                          Đã đình chỉ
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Bình thường</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(report.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedReport(report)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#3368a0] hover:bg-slate-50 mr-2"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.last_page > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50">
            <span className="text-xs text-slate-500">
              Trang {meta.current_page} / {meta.last_page} ({meta.total} báo cáo)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Investigation Detail Modal / Drawer */}
      {selectedReport && !actionType ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">Chi tiết Hồ sơ Báo cáo</h2>
                  {renderStatusBadge(selectedReport.status)}
                </div>
                <p className="text-xs text-slate-400 mt-1">Mã hồ sơ: {selectedReport.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Listing Info */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tin đăng liên quan</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedReport.listing?.title}</h3>
                  <p className="text-xs text-slate-500">Chủ nhà: {selectedReport.listing?.owner?.name} ({selectedReport.listing?.owner?.email})</p>
                </div>
                <div>
                  {selectedReport.listing?.is_suspended ? (
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                      Đang bị đình chỉ
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      Đang công khai
                    </span>
                  )}
                </div>
              </div>

              {selectedReport.listing?.is_suspended && selectedReport.listing?.suspension_reason ? (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-900 border border-rose-200">
                  <strong>Lý do đình chỉ:</strong> {selectedReport.listing.suspension_reason}
                </div>
              ) : null}

              <div className="pt-1 flex gap-2">
                <Link
                  href={`/listings/${selectedReport.listing_id}`}
                  target="_blank"
                  className="text-xs font-semibold text-[#3368a0] hover:underline"
                >
                  Xem trang công khai ↗
                </Link>
              </div>
            </div>

            {/* Reporter & Content */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Người gửi báo cáo</span>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">{selectedReport.reporter?.name}</div>
                  <div className="text-xs text-slate-500">{selectedReport.reporter?.email}</div>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Lý do báo cáo</span>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">
                    {reasonLabels[selectedReport.reason_code] ?? selectedReport.reason_code}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Ngày gửi: {formatDate(selectedReport.created_at)}</div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase text-slate-500">Nội dung người dùng phản ánh</span>
                <div className="mt-1 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-800 border border-slate-200 whitespace-pre-wrap">
                  {selectedReport.description}
                </div>
              </div>

              {selectedReport.internal_notes ? (
                <div>
                  <span className="block text-xs font-semibold uppercase text-amber-700">Ghi chú nội bộ quản trị (Internal Notes)</span>
                  <div className="mt-1 rounded-xl bg-amber-50/70 p-3.5 text-sm text-amber-950 border border-amber-200 whitespace-pre-wrap">
                    {selectedReport.internal_notes}
                  </div>
                </div>
              ) : null}

              {selectedReport.resolution_summary ? (
                <div>
                  <span className="block text-xs font-semibold uppercase text-emerald-800">Kết quả xử lý gửi cho người dùng (Resolution Summary)</span>
                  <div className="mt-1 rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-950 border border-emerald-200 font-medium">
                    {selectedReport.resolution_summary}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Action Buttons Bar */}
            <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                {selectedReport.listing?.is_suspended ? (
                  <button
                    type="button"
                    onClick={() => handleOpenAction(selectedReport, "RESTORE")}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    Khôi phục tin đăng
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenAction(selectedReport, "SUSPEND")}
                    className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100"
                  >
                    Đình chỉ tin đăng này
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {selectedReport.status === "OPEN" ? (
                  <button
                    type="button"
                    onClick={() => handleStartReview(selectedReport)}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700"
                  >
                    Bắt đầu điều tra
                  </button>
                ) : null}

                {selectedReport.status !== "RESOLVED" && selectedReport.status !== "DISMISSED" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenAction(selectedReport, "DISMISS")}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Bác bỏ báo cáo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAction(selectedReport, "RESOLVE")}
                      className="rounded-xl bg-[#3368a0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#254e7a]"
                    >
                      Giải quyết báo cáo
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Decision Action Modal */}
      {selectedReport && actionType ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setActionType(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {actionType === "RESOLVE" && "Giải quyết Báo cáo"}
                {actionType === "DISMISS" && "Bác bỏ Báo cáo"}
                {actionType === "SUSPEND" && "Đình chỉ Tin đăng"}
                {actionType === "RESTORE" && "Khôi phục Tin đăng"}
              </h3>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteAction} className="space-y-4">
              {actionType === "RESOLVE" || actionType === "DISMISS" ? (
                <>
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Kết quả an toàn gửi người báo cáo (bắt buộc)
                    <textarea
                      rows={3}
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Nhập thông điệp thông báo kết quả cho người báo cáo..."
                      className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal text-slate-900 focus:outline-none focus:border-[#3368a0]"
                      required
                    />
                  </label>

                  <label className="block text-xs font-bold text-amber-800 uppercase">
                    Ghi chú nội bộ quản trị viên (chỉ admin thấy)
                    <textarea
                      rows={2}
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Lưu lại căn cứ điều tra, dấu vết vi phạm..."
                      className="mt-1 w-full rounded-xl border border-amber-300 bg-amber-50/40 p-3 text-sm font-normal text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </label>

                  {actionType === "RESOLVE" && !selectedReport.listing?.is_suspended ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={suspendListing}
                          onChange={(e) => setSuspendListing(e.target.checked)}
                          className="size-4 rounded border-slate-300 text-[#3368a0] focus:ring-0"
                        />
                        <span>Đình chỉ tin đăng này đồng thời</span>
                      </label>

                      {suspendListing ? (
                        <input
                          type="text"
                          value={suspensionReason}
                          onChange={(e) => setSuspensionReason(e.target.value)}
                          placeholder="Lý do đình chỉ tin đăng..."
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-[#3368a0]"
                          required={suspendListing}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Lý do {actionType === "SUSPEND" ? "đình chỉ" : "khôi phục"} (bắt buộc)
                  <textarea
                    rows={3}
                    value={directReason}
                    onChange={(e) => setDirectReason(e.target.value)}
                    placeholder="Nhập lý do chi tiết..."
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal text-slate-900 focus:outline-none focus:border-[#3368a0]"
                    required
                  />
                </label>
              )}

              {actionError ? (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                  {actionError}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={submittingAction}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="rounded-xl bg-[#3368a0] px-5 py-2 text-xs font-semibold text-white hover:bg-[#254e7a] disabled:opacity-50"
                >
                  {submittingAction ? "Đang lưu..." : "Xác nhận thực hiện"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

