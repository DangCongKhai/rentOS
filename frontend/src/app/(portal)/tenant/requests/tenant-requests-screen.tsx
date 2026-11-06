"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import {
  getTenantRentalRequest,
  getTenantRentalRequests,
  withdrawTenantRentalRequest,
  type RentalRequestFilter,
  type TenantRentalRequest,
  type TenantRentalRequestDetail,
  type TenantRentalRequestList,
} from "@/lib/rental-requests-api";
import { describeDuration } from "@/components/listings/listing-format";

const requestsPath = "/tenant/requests";
const card = "rounded-2xl border border-border-default bg-surface-card";
const button = "inline-flex min-h-11 items-center justify-center rounded-2xl border px-3 font-semibold";
const outline = button + " border-border-strong bg-surface-card text-link hover:bg-surface-app";
const danger = button + " border-red-300 bg-surface-card text-red-700 hover:bg-red-50";
const filters: { id: RentalRequestFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Đang chờ" },
  { id: "accepted", label: "Đã chấp nhận" },
  { id: "closed", label: "Đã đóng" },
];
const statuses = {
  PENDING: { label: "Đang chờ xử lý", color: "bg-amber-100 text-amber-900" },
  ACCEPTED: { label: "Đã chấp nhận", color: "bg-blue-100 text-blue-900" },
  REJECTED: { label: "Đã từ chối", color: "bg-red-100 text-red-800" },
  WITHDRAWN: { label: "Đã rút lại", color: "bg-slate-200 text-slate-700" },
};
const tenancyStatuses: Record<string, string> = {
  PENDING_CONFIRMATION: "Đang chờ bạn xác nhận",
  AWAITING_REVISION: "Đang chờ chủ nhà sửa đề xuất",
  CONFIRMED: "Hợp đồng đã được hai bên xác nhận",
  ACTIVE: "Kỳ thuê đang diễn ra",
  EXPIRED: "Đề xuất đã hết hạn",
  CANCELLED: "Kỳ thuê đã hủy",
  ENDED: "Kỳ thuê đã kết thúc",
};
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
});
const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh",
});

function dateOnly(value: string) {
  const [year, month, day] = value.split("-");
  return day + "/" + month + "/" + year;
}

function timestamp(value: string) {
  const date = new Date(value);
  return timeFormat.format(date) + " " + dateFormat.format(date);
}

function location(item: TenantRentalRequest) {
  return [item.ward, item.city].filter(Boolean).join(", ");
}

function dateRange(item: TenantRentalRequest) {
  return dateOnly(item.desired_move_in_date) + " – " + dateOnly(item.desired_end_date);
}

function statusDetail(item: TenantRentalRequest) {
  switch (item.status) {
    case "PENDING": return "Chủ nhà sẽ liên lạc cho bạn";
    case "ACCEPTED": {
      if (!item.tenancy) return "Chủ nhà đã gửi đề xuất thuê";
      const label = tenancyStatuses[item.tenancy.status] ?? "Xem trạng thái hợp đồng";
      return item.tenancy.status === "PENDING_CONFIRMATION" && item.tenancy.confirmation_expires_at
        ? label + " · hạn " + timestamp(item.tenancy.confirmation_expires_at)
        : label;
    }
    case "REJECTED": return item.outcome_reason ?? "Chủ nhà đã từ chối yêu cầu";
    case "WITHDRAWN": return item.closed_at ? "Rút ngày " + dateFormat.format(new Date(item.closed_at)) : "Bạn đã rút yêu cầu";
  }
}

function StatusBadge({ item, detailed = false }: { item: TenantRentalRequest; detailed?: boolean }) {
  const { label, color } = statuses[item.status];
  const pending = detailed && item.status === "PENDING";
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold " + color}>
      {pending && <Image src="/images/rental-request/status-clock.svg" alt="" width={14} height={14} />}
      {label}{pending && " · chủ nhà sẽ liên lạc cho bạn"}
    </span>
  );
}

export function TenantRequestsScreen({ requestId }: { requestId?: string }) {
  const { user, status } = useAuth();

  return (
    <section className="-m-4 flex-1 bg-surface-app p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8 xl:px-10">
      {status === "loading" ? <p role="status" className="text-secondary">Đang tải yêu cầu thuê…</p> : user ? (
        <TenantRequestsContent key={user.id + ":" + (requestId ?? "list")} requestId={requestId} />
      ) : (
        <div className={card + " space-y-3 p-6"}>
          <h1 className="text-2xl font-bold text-heading">Yêu cầu thuê của tôi</h1>
          <p className="text-secondary">Đăng nhập để xem và quản lý yêu cầu thuê của bạn.</p>
          <Link href="/login" className={outline}>Đăng nhập</Link>
        </div>
      )}
    </section>
  );
}

type RequestResult =
  | { key: string; list: TenantRentalRequestList; detail?: never; error?: never }
  | { key: string; detail: TenantRentalRequestDetail; list?: never; error?: never }
  | { key: string; error: unknown; list?: never; detail?: never };

function TenantRequestsContent({ requestId }: { requestId?: string }) {
  const [filter, setFilter] = useState<RentalRequestFilter>("all");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<RequestResult>();
  const [target, setTarget] = useState<TenantRentalRequest>();
  const [notice, setNotice] = useState<{ text: string; conflict?: boolean }>();
  const key = [requestId, filter, page, refresh].join(":");
  const current = result?.key === key ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data: RequestResult = requestId
          ? { key, detail: await getTenantRentalRequest(requestId, controller.signal) }
          : { key, list: await getTenantRentalRequests(filter, page, controller.signal) };
        if (!controller.signal.aborted) setResult(data);
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error });
      }
    }

    void load();
    return () => controller.abort();
  }, [requestId, filter, page, key]);

  function refreshAfterWithdraw(conflict: boolean) {
    setTarget(undefined);
    setNotice(conflict
      ? { text: "Yêu cầu đã thay đổi. Trạng thái mới được hiển thị sau khi tải lại.", conflict }
      : { text: "Đã rút yêu cầu thuê." });
    if (!conflict && !requestId) {
      setFilter("closed");
      setPage(1);
    }
    setRefresh((version) => version + 1);
  }

  return (
    <div className={requestId ? "space-y-5" : "space-y-4"}>
      <nav aria-label="Đường dẫn" className="text-sm text-secondary">
        {requestId ? <>
          <Link href={requestsPath} className="text-link hover:underline">Yêu cầu thuê của tôi</Link>
          {" / Yêu cầu #" + requestId.slice(0, 8).toUpperCase()}
        </> : <>
          <Link href="/tenant/contracts" className="text-link hover:underline">Phòng đã thuê</Link>
          {" / Yêu cầu thuê của tôi"}
        </>}
      </nav>
      {!requestId && <h1 className="text-[28px] font-bold tracking-tight text-heading">Yêu cầu thuê của tôi</h1>}
      {notice && <p role={notice.conflict ? "alert" : "status"} className={card + " px-4 py-3 text-sm text-primary"}>{notice.text}</p>}
      {!requestId && (
        <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap border-b border-border-default">
          {filters.map(({ id, label }) => (
            <button type="button" key={id} aria-pressed={filter === id}
              onClick={() => { setFilter(id); setPage(1); }}
              className={"flex items-center gap-2 border-b-[3px] px-3 py-2.5 sm:px-4 " + (filter === id ? "border-action-primary font-bold text-link" : "border-transparent font-medium text-secondary hover:bg-surface-brand-soft")}>
              {label}
              {result?.list && <span className="grid min-w-6 place-items-center rounded-full bg-slate-600 px-1.5 text-xs leading-6 text-white">{result.list.counts[id]}</span>}
            </button>
          ))}
        </nav>
      )}
      {!current && <p role="status" className={card + " p-5 text-secondary"}>Đang tải yêu cầu thuê…</p>}
      {current && "error" in current && <LoadError error={current.error} onRetry={() => setRefresh((version) => version + 1)} />}
      {current?.list && <RequestTable data={current.list} onPage={setPage} onWithdraw={setTarget} />}
      {current?.detail && <RequestDetail item={current.detail} onWithdraw={setTarget} />}
      {target && <WithdrawDialog item={target} onClose={() => setTarget(undefined)} onFinish={refreshAfterWithdraw} />}
    </div>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  return (
    <div className={card + " space-y-3 p-5"}>
      {status === 401 ? <>
        <p role="alert">Phiên đăng nhập đã hết hạn.</p>
        <Link href="/login" className={outline}>Đăng nhập</Link>
      </> : status === 403 || status === 404 ? (
        <p role="alert">{status === 403 ? "Tài khoản của bạn hiện không có quyền xem yêu cầu thuê." : "Không tìm thấy yêu cầu thuê."}</p>
      ) : <>
        <p role="alert">Chưa tải được yêu cầu thuê. Bạn có thể thử lại.</p>
        <button type="button" className={outline} onClick={onRetry}>Thử lại</button>
      </>}
    </div>
  );
}

function RequestTable({ data, onPage, onWithdraw }: {
  data: TenantRentalRequestList;
  onPage: (page: number) => void;
  onWithdraw: (item: TenantRentalRequest) => void;
}) {
  return (
    <div className={card + " overflow-hidden"}>
      {data.items.length === 0 ? <p className="p-8 text-center text-secondary">Chưa có yêu cầu thuê trong mục này.</p> : (
        <div className="max-h-[65dvh] overflow-auto" tabIndex={0} role="region" aria-label="Danh sách yêu cầu thuê">
          <table className="w-full min-w-[880px] text-left text-[15px]">
            <thead className="sticky top-0 bg-slate-50 text-[13px] font-semibold text-secondary">
              <tr>
                {["Bài đăng", "Ngày mong muốn", "Căn ưu tiên", "Trạng thái", "Ngày gửi", "Thao tác"].map((heading) => (
                  <th key={heading} scope="col" className="border-b border-border-default px-4 py-3.5 whitespace-nowrap">
                    <span className={heading === "Thao tác" ? "sr-only" : undefined}>{heading}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-border-default last:border-b-0">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-action-primary/20 text-xs text-link" aria-hidden="true">Ảnh</span>
                      <div>
                        <p className="font-semibold text-heading">{item.title}</p>
                        <p className="text-[13px] text-secondary">{location(item)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="min-w-36 px-4 py-3.5">{dateRange(item)}</td>
                  <td className="px-4 py-3.5">{item.preferred_unit ?? "Không ưu tiên"}</td>
                  <td className="min-w-44 px-4 py-3.5">
                    <StatusBadge item={item} />
                    <p className="mt-1 text-[13px] text-secondary">{statusDetail(item)}</p>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">{dateFormat.format(new Date(item.created_at))}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1 whitespace-nowrap">
                      <Link href={requestsPath + "/" + item.id} className={outline}>Xem<span className="sr-only">{" " + item.title}</span></Link>
                      {item.status === "PENDING" && <button type="button" className={danger + " px-4"} onClick={() => onWithdraw(item)}>Rút yêu cầu</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(data.last_page > 1 || data.page > 1) && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-default px-4 py-3 text-secondary">
          <button type="button" className={outline} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Trước</button>
          <span>Trang {data.page}/{data.last_page}</span>
          <button type="button" className={outline} disabled={data.page >= data.last_page} onClick={() => onPage(data.page + 1)}>Sau</button>
        </div>
      )}
    </div>
  );
}

function RequestDetail({ item, onWithdraw }: { item: TenantRentalRequestDetail; onWithdraw: (item: TenantRentalRequest) => void }) {
  const duration = describeDuration(item.desired_move_in_date, item.desired_end_date);
  const pending = item.status === "PENDING";
  const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-heading">{item.title}</h1>
          <p className="text-sm text-secondary">{[location(item), "Đã gửi lúc " + timestamp(item.created_at)].filter(Boolean).join(" · ")}</p>
        </div>
        <StatusBadge item={item} detailed />
      </header>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div className={(pending ? "rounded-2xl border border-amber-300 bg-amber-50" : card) + " space-y-2 p-5 sm:p-6"}>
            <h2 className="text-lg font-semibold text-heading">
              {pending ? "Chủ nhà sẽ liên lạc cho bạn. Chưa có căn nào được giữ chỗ." : statuses[item.status].label}
            </h2>
            <p className="text-secondary">
              {pending ? "Chủ nhà sẽ trao đổi và hẹn xem nhà với bạn. Căn chỉ được giữ khi chủ nhà gửi đề xuất hợp đồng." : statusDetail(item)}
            </p>
            {item.status === "WITHDRAWN" && item.outcome_reason && <p className="break-words text-secondary">Lý do rút: {item.outcome_reason}</p>}
            {pending && item.desired_move_in_date < localDate && <p className="text-amber-900">Ngày dọn vào mong muốn đã qua. Bạn có thể rút yêu cầu nếu không còn nhu cầu thuê.</p>}
            {pending && <button type="button" className={danger + " mt-1 px-5"} onClick={() => onWithdraw(item)}>Rút yêu cầu</button>}
            {item.status === "ACCEPTED" && <Link href="/tenant/contracts" className={outline + " mt-1"}>Căn hộ và hợp đồng</Link>}
          </div>
          <section className={card + " p-5 sm:p-6"}>
            <h2 className="mb-3 text-lg font-semibold text-heading">Thông tin bạn đã gửi</h2>
            <dl className="grid gap-2.5 break-words sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
              <dt className="text-secondary">Tên liên hệ</dt><dd>{item.contact_name}</dd>
              <dt className="text-secondary">Số điện thoại</dt><dd>{item.contact_phone} <span className="text-[13px] text-secondary">· Số liên hệ, chưa xác minh</span></dd>
              <dt className="text-secondary">Ngày thuê</dt><dd>{dateRange(item)}{duration && " · " + duration}</dd>
              <dt className="text-secondary">Căn ưu tiên</dt><dd>{item.preferred_unit ?? "Không ưu tiên"}</dd>
              <dt className="text-secondary">Lời nhắn</dt><dd className="whitespace-pre-wrap">{item.message || "Không có lời nhắn"}</dd>
            </dl>
            <p className="mt-3 text-[13px] text-secondary">Lưu theo lúc gửi. Các thay đổi hồ sơ sau này không làm đổi thông tin này.</p>
          </section>
        </div>
        <section className={card + " p-5 sm:p-6"}>
          <h2 className="mb-4 text-lg font-semibold text-heading">Tiến trình</h2>
          <ol>
            <TimelineStep title="Đã gửi" done>{timestamp(item.created_at)}</TimelineStep>
            <TimelineStep title="Chủ nhà liên lạc">{pending ? "Đang chờ" : "Trao đổi ngoài ứng dụng"}</TimelineStep>
            <TimelineStep title="Kết quả" done={!pending} last>
              {pending ? "Chủ nhà gửi đề xuất hoặc từ chối" : statuses[item.status].label + (item.closed_at ? " · " + timestamp(item.closed_at) : "")}
            </TimelineStep>
          </ol>
        </section>
      </div>
    </>
  );
}

function TimelineStep({ title, done, last, children }: { title: string; done?: boolean; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[22px_1fr] gap-x-3 pb-4">
      {!last && <span aria-hidden="true" className="absolute top-5 bottom-0 left-[10px] w-0.5 bg-border-default" />}
      <span className={"relative grid size-[22px] place-items-center rounded-full border-2 " + (done ? "border-action-primary bg-action-primary" : "border-border-strong bg-surface-card")}>
        {done && <Image src="/images/rental-request/timeline-check.svg" alt="" width={14} height={14} />}
      </span>
      <div>
        <p className="font-semibold text-heading">{title}</p>
        <p className="mt-1 text-[13px] text-secondary">{children}</p>
      </div>
    </li>
  );
}

function WithdrawDialog({ item, onClose, onFinish }: {
  item: TenantRentalRequest;
  onClose: () => void;
  onFinish: (conflict: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lastAttempt = useRef<{ reason: string; id: string } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const cleanReason = reason.trim();
    if (lastAttempt.current?.reason !== cleanReason) {
      lastAttempt.current = { reason: cleanReason, id: crypto.randomUUID() };
    }
    setSubmitting(true);
    setError("");
    try {
      await withdrawTenantRentalRequest(item.id, {
        expected_updated_at: item.updated_at,
        client_operation_id: lastAttempt.current.id,
        reason: cleanReason,
      });
      onFinish(false);
    } catch (failure) {
      if (failure instanceof ApiError && (failure.status === 409 || failure.status === 404)) {
        onFinish(true);
      } else {
        setError(failure instanceof ApiError
          ? failure.errors.reason?.[0] ?? failure.message
          : "Chưa xác nhận được kết quả. Bạn có thể thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="withdraw-title"
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-[520px] rounded-2xl border border-border-default bg-surface-card p-5 text-primary shadow-xl backdrop:bg-surface-nav-dark/60 sm:p-6">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <h2 id="withdraw-title" className="text-xl font-bold text-heading">Rút yêu cầu thuê?</h2>
        <p className="text-secondary">Chủ nhà sẽ được thông báo rằng bạn đã rút yêu cầu cho <strong>{item.title}</strong>.</p>
        <label className="grid gap-1 font-medium text-heading">
          Lý do (tùy chọn)
          <textarea value={reason} maxLength={500} disabled={submitting} onChange={(event) => setReason(event.target.value)}
            className="min-h-24 rounded-lg border border-border-default px-3 py-2 font-normal" />
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={outline} disabled={submitting} onClick={onClose}>Hủy</button>
          <button type="submit" className={button + " border-red-700 bg-red-700 px-4 text-white"} disabled={submitting}>
            {submitting ? "Đang rút…" : "Xác nhận rút yêu cầu"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
