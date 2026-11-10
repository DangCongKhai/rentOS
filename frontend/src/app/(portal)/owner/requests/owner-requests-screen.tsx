"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { describeDuration, dong } from "@/components/listings/listing-format";
import { ApiError } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { dateRange, statuses, timestamp } from "@/lib/rental-request-format";
import {
  getOwnerRentalRequest,
  getOwnerRentalRequests,
  rejectOwnerRentalRequest,
  type OwnerRentalRequest,
  type OwnerRentalRequestDetail,
  type OwnerRentalRequestList,
  type RentalRequestStatus,
} from "@/lib/rental-requests-api";

const requestsPath = "/owner/requests";
const card = "rounded-2xl border border-border-default bg-surface-card";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-semibold";
const outline = button + " border-border-default bg-surface-card text-link hover:bg-surface-app";
const primary = button + " border-action-primary bg-action-primary text-white";
const danger = button + " border-red-300 bg-surface-card text-red-700 hover:bg-red-50";
const tabs: RentalRequestStatus[] = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"];
const localDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

function waitLabel(item: OwnerRentalRequest) {
  const end = item.closed_at ? Date.parse(item.closed_at) : Date.now();
  const hours = Math.max(0, Math.floor((end - Date.parse(item.created_at)) / 3_600_000));
  return hours >= 24 ? Math.floor(hours / 24) + " ngày" : hours > 0 ? hours + " giờ" : "Dưới 1 giờ";
}

function pastMoveIn(item: OwnerRentalRequest) {
  return item.status === "PENDING" && item.desired_move_in_date < localDay.format(new Date());
}

function requestCode(id: string) {
  return "#" + id.slice(0, 8).toUpperCase();
}

function StatusBadge({ item, detailed = false }: { item: OwnerRentalRequest; detailed?: boolean }) {
  const { label, color } = statuses[item.status];
  const clock = detailed ? "owner-detail-clock" : "owner-status-clock";
  return (
    <span className={"inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold " + color}>
      {item.status === "PENDING" && <Image src={"/images/rental-request/" + clock + ".svg"} alt="" width={14} height={14} />}
      {label}{detailed && item.status === "PENDING" && " · đã chờ " + waitLabel(item)}
    </span>
  );
}

function DateWarning() {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-[13px] font-semibold text-orange-900">
      <Image src="/images/rental-request/owner-date-flag.svg" alt="" width={14} height={14} />
      Ngày dọn vào mong muốn đã qua
    </span>
  );
}

export function OwnerRequestsScreen({ requestId }: { requestId?: string }) {
  const { user, status } = useAuth();

  return (
    <section className="-m-4 flex-1 bg-surface-app p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8 xl:px-10">
      {status === "loading" ? <p role="status" className="text-secondary">Đang tải yêu cầu thuê…</p> : user ? (
        <OwnerRequestsContent key={user.id + ":" + (requestId ?? "list")} requestId={requestId} ownerName={user.name} />
      ) : (
        <div className={card + " space-y-3 p-6"}>
          <h1 className="text-2xl font-bold text-heading">Yêu cầu thuê</h1>
          <p className="text-secondary">Đăng nhập để xem yêu cầu thuê gửi đến bất động sản của bạn.</p>
          <Link href="/login" className={outline}>Đăng nhập</Link>
        </div>
      )}
    </section>
  );
}

type Result =
  | { key: string; list: OwnerRentalRequestList; detail?: never; error?: never }
  | { key: string; detail: OwnerRentalRequestDetail; list?: never; error?: never }
  | { key: string; error: unknown; list?: never; detail?: never };

function OwnerRequestsContent({ requestId, ownerName }: { requestId?: string; ownerName: string }) {
  const [tab, setTab] = useState<RentalRequestStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result>();
  const [rejecting, setRejecting] = useState(false);
  const [notice, setNotice] = useState<{ conflict: boolean; text: string }>();
  const key = [requestId, tab, page, reload].join(":");
  const current = result?.key === key ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data: Result = requestId
          ? { key, detail: await getOwnerRentalRequest(requestId, controller.signal) }
          : { key, list: await getOwnerRentalRequests(tab, page, controller.signal) };
        if (!controller.signal.aborted) setResult(data);
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error });
      }
    }
    void load();
    return () => controller.abort();
  }, [requestId, tab, page, key]);

  function refresh() {
    setReload((value) => value + 1);
  }

  function afterReject(conflict: boolean) {
    setRejecting(false);
    setNotice({ conflict, text: conflict ? "Yêu cầu đã thay đổi. Đang tải trạng thái mới." : "Đã từ chối yêu cầu thuê." });
    refresh();
  }

  return (
    <div className="space-y-5">
      {requestId ? (
        <nav aria-label="Đường dẫn" className="text-sm text-secondary">
          <Link href={requestsPath} className="text-link hover:underline">Yêu cầu thuê</Link>
          {" / " + requestCode(requestId)}
        </nav>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-heading">Yêu cầu thuê</h1>
            <p className="text-sm text-secondary">Chủ nhà: {ownerName}</p>
          </header>
          <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap border-b border-border-default">
            {tabs.map((status) => (
              <button type="button" key={status} aria-pressed={tab === status}
                onClick={() => { setTab(status); setPage(1); }}
                className={"flex items-center gap-2 border-b-[3px] px-3 py-2.5 sm:px-4 " + (tab === status ? "border-action-primary font-bold text-link" : "border-transparent font-medium text-secondary hover:bg-surface-brand-soft")}>
                {status === "PENDING" ? "Đang chờ" : statuses[status].label}
                {status === "PENDING" && result?.list && <span className="grid min-w-6 place-items-center rounded-full bg-action-primary px-1.5 text-xs leading-6 text-white">{result.list.counts.PENDING}</span>}
              </button>
            ))}
          </nav>
        </>
      )}
      {notice && <p role={notice.conflict ? "alert" : "status"} className={card + " px-4 py-3"}>{notice.text}</p>}
      {!current && <p role="status" className={card + " p-5 text-secondary"}>Đang tải yêu cầu thuê…</p>}
      {current && "error" in current && <LoadError error={current.error} onRetry={refresh} />}
      {current?.list && <Inbox data={current.list} onPage={setPage} />}
      {current?.detail && <Detail item={current.detail} onReject={() => setRejecting(true)} />}
      {rejecting && current?.detail && <RejectDialog item={current.detail} onClose={() => setRejecting(false)} onFinish={afterReject} />}
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
        <p role="alert">{status === 403 ? "Tài khoản của bạn hiện không có quyền xem hộp thư yêu cầu thuê." : "Không tìm thấy yêu cầu thuê."}</p>
      ) : <>
        <p role="alert">Chưa tải được yêu cầu thuê. Bạn có thể thử lại.</p>
        <button type="button" className={outline} onClick={onRetry}>Thử lại</button>
      </>}
    </div>
  );
}

function Inbox({ data, onPage }: { data: OwnerRentalRequestList; onPage: (page: number) => void }) {
  return (
    <>
      <div className={card + " p-3 sm:p-6"}>
        {data.items.length === 0 ? <p className="py-6 text-center text-secondary">Chưa có yêu cầu thuê trong mục này.</p> : (
          <div className="max-h-[65dvh] overflow-auto" tabIndex={0} role="region" aria-label="Hộp thư yêu cầu thuê">
            <table className="w-full min-w-[850px] text-left text-[15px]">
              <thead className="sticky top-0 z-10 bg-surface-app text-[13px] font-semibold text-secondary">
                <tr>
                  {["Người thuê", "Bài đăng · căn ưu tiên", "Ngày mong muốn", "Đã chờ", "Trạng thái"].map((heading) => (
                    <th key={heading} scope="col" className="border-b border-border-default px-4 py-3 whitespace-nowrap">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="relative border-b border-border-default hover:bg-surface-app/70 last:border-b-0">
                    <td className="min-w-36 px-4 py-4">
                      <Link href={requestsPath + "/" + item.id} className="font-semibold text-heading after:absolute after:inset-0 after:content-[''] hover:underline">
                        <span className="sr-only">Xem yêu cầu của </span>{item.contact_name}
                      </Link>
                      <p className="text-[13px] font-semibold text-link">{item.contact_phone}</p>
                    </td>
                    <td className="min-w-48 px-4 py-4">
                      <p>{item.title}</p>
                      <p className="text-[13px] text-secondary">Ưu tiên: {item.preferred_unit ?? "Không ưu tiên"}</p>
                    </td>
                    <td className="min-w-36 px-4 py-4">{dateRange(item)}</td>
                    <td className="px-4 py-4 font-semibold whitespace-nowrap">{waitLabel(item)}</td>
                    <td className="min-w-44 px-4 py-4">
                      <div className="grid gap-1">
                        <StatusBadge item={item} />
                        {pastMoveIn(item) && <DateWarning />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(data.last_page > 1 || data.page > 1) && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border-default pt-3 text-secondary">
            <button type="button" className={outline} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Trước</button>
            <span>Trang {data.page}/{data.last_page}</span>
            <button type="button" className={outline} disabled={data.page >= data.last_page} onClick={() => onPage(data.page + 1)}>Sau</button>
          </div>
        )}
      </div>
      <p className="text-sm text-secondary">Sắp xếp mục cũ nhất lên trước. Nhấn vào hàng để xem chi tiết.</p>
    </>
  );
}

function Detail({ item, onReject }: { item: OwnerRentalRequestDetail; onReject: () => void }) {
  const pending = item.status === "PENDING";
  const duration = describeDuration(item.desired_move_in_date, item.desired_end_date);
  const phone = item.contact_phone.replace(/[^\d+]/g, "");

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-heading">{item.contact_name}</h1>
        <StatusBadge item={item} detailed />
        {pastMoveIn(item) && <DateWarning />}
      </header>
      {pending && (
        <div className="flex items-start gap-3 rounded-2xl border border-action-primary/25 bg-action-primary/5 px-5 py-3.5 text-blue-900">
          <Image src="/images/rental-request/owner-phone.svg" alt="" width={18} height={18} className="shrink-0" />
          <p>Hãy gọi cho người thuê để trao đổi. Việc xem nhà và thương lượng diễn ra ngoài ứng dụng rentOS. Yêu cầu giữ trạng thái Đang chờ trong lúc hai bên trao đổi.</p>
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,31%)]">
        <div className="space-y-5">
          <section className={card + " flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"}>
            <div>
              <h2 className="text-sm text-secondary">Liên hệ</h2>
              <p className="text-lg font-semibold text-heading">{item.contact_name}</p>
              <p className="text-lg font-semibold text-link">{item.contact_phone}</p>
              <p className="text-[13px] text-secondary">Bản chụp thông tin tại thời điểm gửi · số chưa xác minh</p>
            </div>
            {phone && <a href={"tel:" + phone} className={primary}>
              <Image src="/images/rental-request/owner-call.svg" alt="" width={18} height={18} /> Gọi
            </a>}
          </section>
          <section className={card + " p-5 sm:p-6"}>
            <h2 className="mb-3 text-lg font-semibold text-heading">Yêu cầu</h2>
            <dl className="grid gap-2.5 break-words sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
              <dt className="text-secondary">Bài đăng</dt><dd>{item.title}</dd>
              <dt className="text-secondary">Ngày thuê</dt><dd>{dateRange(item)}{duration && " · " + duration}</dd>
              <dt className="text-secondary">Căn ưu tiên</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {item.preferred_unit ?? "Không ưu tiên"}
                {item.preferred_unit_available !== null && (
                  <span className={"rounded-full px-2.5 py-1 text-[13px] font-semibold " + (item.preferred_unit_available ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900")}>
                    {item.preferred_unit_available ? "Còn trống cho khoảng ngày này" : "Không khả dụng cho toàn bộ khoảng ngày"}
                  </span>
                )}
              </dd>
              <dt className="text-secondary">Lời nhắn</dt><dd className="whitespace-pre-wrap">{item.message || "Không có lời nhắn"}</dd>
            </dl>
            {pending && (
              <div className="mt-4 space-y-3">
                <h3 className="font-semibold text-heading">Căn thay thế phù hợp với toàn bộ khoảng thời gian</h3>
                {item.alternative_units.length ? (
                  <ul className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {item.alternative_units.map((unit) => (
                      <li key={unit.id} className="rounded-full border border-action-primary/20 bg-action-primary/10 px-3 py-1.5 text-sm text-link">
                        {unit.label} · {dong(Number(unit.monthly_rent))}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-secondary">Chưa có căn thay thế phù hợp.</p>}
                <p className="text-[13px] text-secondary">Căn ưu tiên và tình trạng trống chỉ mang tính tham khảo tại thời điểm xem.</p>
              </div>
            )}
          </section>
        </div>
        <div className="space-y-4">
          <section className={card + " space-y-3 p-5 sm:p-6"}>
            <h2 className="text-lg font-semibold text-heading">{pending ? "Hành động" : "Kết quả"}</h2>
            {pending ? <>
              <button type="button" className={primary + " w-full"} disabled>Tạo đề xuất kỳ thuê</button>
              <button type="button" className={danger + " w-full"} onClick={onReject}>Từ chối</button>
              <p className="text-[13px] text-secondary">Tạo đề xuất kỳ thuê sẽ khả dụng khi luồng hợp đồng được tích hợp.</p>
            </> : <>
              <p className="text-secondary">{statuses[item.status].label}</p>
              {item.outcome_reason && <p className="break-words whitespace-pre-wrap">{item.outcome_reason}</p>}
            </>}
          </section>
          <section className={card + " space-y-2 p-5 sm:p-6"}>
            <h2 className="text-lg font-semibold text-heading">Dòng thời gian</h2>
            <p><time dateTime={item.created_at} className="font-semibold">{timestamp(item.created_at)}</time> · Người thuê gửi yêu cầu</p>
            {item.closed_at && <p><time dateTime={item.closed_at} className="font-semibold">{timestamp(item.closed_at)}</time> · {statuses[item.status].label}</p>}
          </section>
        </div>
      </div>
    </>
  );
}

function RejectDialog({ item, onClose, onFinish }: {
  item: OwnerRentalRequestDetail;
  onClose: () => void;
  onFinish: (conflict: boolean) => void;
}) {
  const titleId = useId();
  const errorId = useId();
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("Nhập lý do từ chối yêu cầu thuê.");
      return;
    }
    if (lastAttempt.current?.reason !== cleanReason) {
      lastAttempt.current = { reason: cleanReason, id: crypto.randomUUID() };
    }
    setSubmitting(true);
    setError("");
    try {
      await rejectOwnerRentalRequest(item.id, {
        reason: cleanReason,
        expected_updated_at: item.updated_at,
        client_operation_id: lastAttempt.current.id,
      });
      onFinish(false);
    } catch (failure) {
      if (failure instanceof ApiError && (failure.status === 409 || failure.status === 404)) {
        onFinish(true);
      } else {
        setError(failure instanceof ApiError ? failure.errors.reason?.[0] ?? failure.message : "Chưa xác nhận được kết quả. Bạn có thể thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] overflow-y-auto rounded-2xl border border-border-default bg-surface-card text-primary shadow-xl backdrop:bg-surface-nav-dark/60">
      <header className="flex items-start justify-between gap-3 border-b border-border-default px-5 py-5 sm:px-7">
        <div>
          <h2 id={titleId} className="text-[22px] font-bold text-heading">Từ chối yêu cầu thuê</h2>
          <p className="mt-1 text-sm text-secondary">{item.contact_name} · {requestCode(item.id)}</p>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose} disabled={submitting}>
          <Image src="/images/rental-request/owner-reject-close.svg" alt="" width={35} height={35} />
        </button>
      </header>
      <form className="space-y-4 px-5 py-5 sm:px-7 sm:py-6" onSubmit={submit} noValidate>
        <label className="grid gap-2 font-semibold text-heading">
          Lý do từ chối *
          <textarea value={reason} maxLength={500} required disabled={submitting}
            onChange={(event) => { setReason(event.target.value); setError(""); }}
            aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)}
            placeholder="Nhập lý do để người thuê hiểu quyết định của bạn"
            className="min-h-28 resize-y rounded-xl border border-border-default bg-surface-app/50 p-3 font-normal" />
        </label>
        <p className="text-[13px] text-secondary">Người thuê sẽ thấy lý do này trong chi tiết yêu cầu.</p>
        {error && <p id={errorId} role="alert" className="text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-3 pt-3">
          <button type="submit" className={button + " border-red-700 bg-red-700 text-white"} disabled={submitting}>
            {submitting ? "Đang từ chối…" : "Xác nhận từ chối"}
          </button>
          <button type="button" className={outline} disabled={submitting} onClick={onClose}>Quay lại</button>
        </div>
      </form>
    </dialog>
  );
}
