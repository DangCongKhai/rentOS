"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/admin-icons";
import { AdminPreviewReset } from "@/components/admin/admin-preview-reset";
import { useAdminReviewPreview } from "@/lib/admin-review-store";
import { getReviewQueue } from "@/lib/admin-review-queue";
import { adminPreviewMode, getAdminQueue, waitingLabel, type AdminQueueResponse } from "@/lib/admin-review-api";
import { ApiError } from "@/lib/auth-api";
import { useAdminApi } from "@/components/admin/admin-api-provider";

const submittedDate = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const submittedTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default function ReviewQueuePage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);
  const { items, ready: previewReady, storageError } = useAdminReviewPreview();
  const { revision, refresh } = useAdminApi();
  const [retry, setRetry] = useState(0);
  const requestKey = `${search}:${page}:${pageSize}:${revision}:${retry}`;
  const [result, setResult] = useState<{ key: string; data: AdminQueueResponse | null; error: string | null } | null>(null);
  useEffect(() => {
    if (adminPreviewMode) return;
    const controller = new AbortController();
    getAdminQueue(search, page, pageSize, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setResult({ key: requestKey, data, error: null });
      if (page > data.meta.last_page) setPage(Math.max(1, data.meta.last_page));
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && [401, 403].includes(error.status)) refresh();
      setResult({ key: requestKey, data: null, error: "Không thể tải hàng đợi kiểm duyệt. Vui lòng thử lại." });
    });
    return () => controller.abort();
  }, [search, page, pageSize, requestKey, refresh]);
  const apiResult = result?.key === requestKey ? result : null;
  const ready = adminPreviewMode ? previewReady : Boolean(apiResult);
  const error = adminPreviewMode ? storageError : apiResult?.error;

  const filtered = getReviewQueue(items, search);
  const total = adminPreviewMode ? filtered.length : apiResult?.data?.meta.total ?? 0;
  const totalPages = adminPreviewMode ? Math.max(1, Math.ceil(filtered.length / pageSize)) : apiResult?.data?.meta.last_page ?? 1;
  const currentPage = Math.min(page, totalPages);
  const rows = !adminPreviewMode ? (apiResult?.data?.data ?? []).map((item) => ({ id: item.id, title: item.title, owner: item.owner.name, property: item.property.name, units: item.units_count, photos: item.photos_count, submittedAt: item.submitted_at, waiting: waitingLabel(item.submitted_at) })) : filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <section aria-labelledby="queue-title">
      <div className="admin-pageHeading">
        <h1 id="queue-title">Hàng đợi kiểm duyệt</h1>

        <label className="admin-queueSearch">
          <span className="sr-only">
            Tìm theo tiêu đề hoặc chủ nhà
          </span>
          <AdminIcon name="search" />
          <input
            type="search"
            value={search}
            placeholder="Tìm theo tiêu đề hoặc chủ nhà"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <p className="admin-queueDescription">
        Chỉ gồm bài đăng gửi duyệt lần đầu, cũ nhất lên đầu.{" "}
        Các chỉnh sửa sau khi được duyệt không xuất hiện ở đây.
      </p>
      {adminPreviewMode && <p className="admin-queuePreview">Bản xem trước · Quyết định chỉ lưu trong trình duyệt này.</p>}
      {error && <p className="admin-reviewError" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></p>}

      {!ready ? <p className="admin-reviewLoading" role="status">Đang tải hàng đợi…</p> : error ? null : rows.length === 0 ? (
        <div className="admin-queueEmpty" role="status">
          <p>Trạng thái rỗng</p>
          <h2>
            {search.trim()
              ? "Không tìm thấy bài đăng phù hợp."
              : "Không có bài đăng nào đang chờ."}
          </h2>
          {search.trim() && (
            <button
              type="button"
              className="admin-queueClear"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              Xóa tìm kiếm
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="admin-queueTableRegion" role="region" aria-label="Bảng hàng đợi kiểm duyệt, cuộn ngang để xem đầy đủ" tabIndex={0}>
            <table className="admin-queueTable">
              <caption className="sr-only">
                Danh sách tin chờ kiểm duyệt lần đầu
              </caption>
              <thead>
                <tr>
                  {[
                    "Tiêu đề", "Chủ nhà", "Bất động sản",
                    "Căn", "Ảnh", "Gửi lúc", "Đã chờ", "Thao tác",
                  ].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.title}</th>
                    <td>{item.owner}</td>
                    <td>{item.property}</td>
                    <td>{item.units}</td>
                    <td>{item.photos}</td>
                    <td>
                      <time dateTime={item.submittedAt}>
                        <span>{submittedTime.format(new Date(item.submittedAt))}</span>
                        <span>{submittedDate.format(new Date(item.submittedAt))}</span>
                      </time>
                    </td>
                    <td>
                      <span className="admin-queueWaiting">{item.waiting}</span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/review-queue/${item.id}`}
                        aria-label={`Mở xem xét ${item.title}`}
                        className="admin-queueReview"
                      >
                        Mở xem xét
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            aria-label="Phân trang hàng đợi"
            className="admin-queuePagination"
          >
            <p className="admin-queueResults" role="status">
              Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} / {total} tin
            </p>
            <div className="admin-queuePageSize">
              <span id="queue-page-size-label">Số tin mỗi trang</span>
              <PageSizeSelect value={pageSize} onChange={(size) => {
                setPageSize(size);
                setPage(1);
              }} />
            </div>
            <div className="admin-queuePageControls">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Trước
              </button>
              <span aria-live="polite">Trang {currentPage}/{totalPages}</span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Sau
              </button>
            </div>
          </nav>
        </>
      )}
      {adminPreviewMode && <AdminPreviewReset />}
    </section>
  );
}

const pageSizes = [2, 4, 8];

function PageSizeSelect({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    options.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div ref={container} className="admin-queuePageSizeSelect"
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) {
          setActive(pageSizes.indexOf(value));
          setOpen(true);
        } else setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + pageSizes.length) % pageSizes.length);
      } else if (open && (event.key === "Home" || event.key === "End")) {
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : pageSizes.length - 1);
      } else if (open && pageSizes.some((size) => String(size) === event.key)) {
        event.preventDefault();
        setActive(pageSizes.indexOf(Number(event.key)));
      }
    }}>
    <button ref={trigger} type="button" className="admin-queuePageSizeTrigger"
      aria-labelledby="queue-page-size-label queue-page-size-value" aria-haspopup="listbox" aria-expanded={open} aria-controls="queue-page-size-options"
      onClick={() => { setActive(pageSizes.indexOf(value)); setOpen((current) => !current); }}>
      <span id="queue-page-size-value">{value}</span>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
    </button>
    {open && <div id="queue-page-size-options" role="listbox" aria-labelledby="queue-page-size-label" className="admin-queuePageSizeOptions">
      {pageSizes.map((size, index) => <button key={size} ref={(element) => { options.current[index] = element; }}
        type="button" role="option" aria-selected={value === size} tabIndex={-1}
        onClick={() => { setOpen(false); trigger.current?.focus(); onChange(size); }}>
        {size}
      </button>)}
    </div>}
  </div>;
}
