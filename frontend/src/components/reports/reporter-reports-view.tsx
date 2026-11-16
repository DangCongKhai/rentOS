"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTenantReports, type ReporterListingReport, type PaginationMeta } from "@/lib/reports-api";

const reasonLabels: Record<string, string> = {
  FRAUD: "Gian lận / Lừa đảo",
  MISLEADING: "Sai lệch thông tin",
  HARMFUL: "Nội dung độc hại",
  OTHER: "Lý do khác",
};

export function ReporterReportsView() {
  const [reports, setReports] = useState<ReporterListingReport[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReporterListingReport | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await getTenantReports(page, 10);
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
      } catch {
        if (!ignore) {
          setError("Không thể tải danh sách báo cáo. Vui lòng thử lại sau.");
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [page, reloadKey]);

  function renderStatusBadge(status: string) {
    switch (status) {
      case "OPEN":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            Đã tiếp nhận
          </span>
        );
      case "REVIEWING":
        return (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
            Đang điều tra
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            Đã xử lý
          </span>
        );
      case "DISMISSED":
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
            Đã bác bỏ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {status}
          </span>
        );
    }
  }

  function formatDate(isoString?: string | null) {
    if (!isoString) return "--";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch {
      return isoString;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Báo cáo của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi tiến trình xem xét và kết quả xử lý các báo cáo vi phạm tin đăng mà bạn đã gửi.
          </p>
        </div>
        <Link
          href="/listings"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          Khám phá tin đăng
        </Link>
      </div>

      {loading && (reports?.length ?? 0) === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 w-48 rounded bg-slate-200" />
                <div className="h-6 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="h-4 w-3/4 rounded bg-slate-100" />
              <div className="h-4 w-1/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-medium text-rose-800">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-3 inline-flex items-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      ) : (reports?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Chưa có báo cáo nào</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Khi bạn phát hiện tin đăng có dấu hiệu gian lận hoặc vi phạm và gửi báo cáo, kết quả điều tra sẽ hiển thị tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md cursor-pointer"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900 line-clamp-1">
                    {report.listing_title ?? "Tin đăng công khai"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {reasonLabels[report.reason_code] ?? report.reason_code}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {renderStatusBadge(report.status)}
                  <span className="text-xs text-slate-400">{formatDate(report.created_at)}</span>
                </div>
              </div>

              <div className="pt-3">
                <p className="text-sm text-slate-600 line-clamp-2">
                  <strong className="text-slate-700">Mô tả của bạn:</strong> {report.description}
                </p>

                {report.resolution_summary ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                    <div className="flex items-start gap-2">
                      <svg className="size-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-emerald-800">
                          Kết quả từ Ban quản trị:
                        </span>
                        <p className="mt-0.5 text-sm text-emerald-950 font-medium">
                          {report.resolution_summary}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {meta && meta.last_page > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-xs text-slate-500">
                Hiển thị trang {meta.current_page} / {meta.last_page} ({meta.total} báo cáo)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Trang trước
                </button>
                <button
                  type="button"
                  disabled={page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Trang sau
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Detail Dialog */}
      {selectedReport ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Chi tiết báo cáo vi phạm</h3>
                <p className="text-xs text-slate-400 mt-0.5">Mã báo cáo: {selectedReport.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase">Tin đăng bị báo cáo</span>
                <span className="font-medium text-slate-900">{selectedReport.listing_title ?? "Không xác định"}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Lý do vi phạm</span>
                  <span className="font-medium text-slate-900">{reasonLabels[selectedReport.reason_code] ?? selectedReport.reason_code}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Trạng thái</span>
                  <div className="mt-1">{renderStatusBadge(selectedReport.status)}</div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase">Thời gian gửi</span>
                <span className="text-slate-700">{formatDate(selectedReport.created_at)}</span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase">Mô tả vi phạm bạn cung cấp</span>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 text-slate-800 whitespace-pre-wrap">
                  {selectedReport.description}
                </div>
              </div>

              {selectedReport.resolution_summary ? (
                <div>
                  <span className="block text-xs font-semibold text-emerald-800 uppercase">Phản hồi từ Ban quản trị</span>
                  <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 font-medium">
                    {selectedReport.resolution_summary}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

