"use client";

import { useState, type FormEvent } from "react";
import {
  ApiError,
  correctOwnerTenancyRenewal,
  proposeOwnerTenancyRenewal,
  rejectOwnerTenancyRenewal,
  requestTenantTenancyRenewal,
  withdrawTenantTenancyRenewal,
  type TenancyContractRecord,
  type TenancyRenewalRequest,
  type TenancyTimeline,
} from "@/lib/auth-api";

type Party = "owner" | "tenant";
type FormMode = "request" | "proposal" | "reject" | null;

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "vi-VN",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatMoney(value: string | number): string {
  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

function addOneDay(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function policiesSnapshot(
  contract: TenancyContractRecord | null,
): Record<string, unknown> {
  if (!contract) return {};
  const value = contract.policies_snapshot;

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-rose-700">{message}</p> : null;
}

function RenewalField({
  label,
  id,
  value,
  onChange,
  type = "number",
  min,
  error,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: "date" | "number";
  min?: string | number;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
      />
      <FieldError message={error} />
    </div>
  );
}

function RenewalRequestDetails({
  renewal,
  currentEndDate,
  onWithdraw,
  busy,
}: {
  renewal: TenancyRenewalRequest;
  currentEndDate: string | null;
  onWithdraw: () => void;
  busy: boolean;
}) {
  return (
    <article className="rounded-2xl border border-[#e1e7ed] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
          Yêu cầu gia hạn · {renewal.status === "PENDING" ? "Đang chờ" : renewal.status}
        </span>
        <time className="text-xs text-slate-500" dateTime={renewal.created_at}>
          Gửi {formatDateTime(renewal.created_at)}
        </time>
      </div>

      <dl className="mt-4 grid grid-cols-[minmax(120px,0.3fr)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-slate-500">Kết thúc hiện tại</dt>
        <dd className="font-medium text-slate-900">{formatDate(currentEndDate)}</dd>
        <dt className="text-slate-500">Kết thúc yêu cầu</dt>
        <dd className="font-medium text-slate-900">{formatDate(renewal.requested_end_date)}</dd>
        <dt className="text-slate-500">Giá đề xuất</dt>
        <dd className="font-medium text-slate-900">{formatMoney(renewal.proposed_monthly_rent)}/tháng</dd>
        {renewal.message && (
          <>
            <dt className="text-slate-500">Lời nhắn</dt>
            <dd className="whitespace-pre-wrap text-slate-900">{renewal.message}</dd>
          </>
        )}
      </dl>

      {renewal.status === "PENDING" && (
        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy}
          className="mt-5 min-h-11 rounded-[15px] border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Đang xử lý…" : "Rút yêu cầu gia hạn"}
        </button>
      )}
      {renewal.review_reason && (
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          Lý do từ chối: {renewal.review_reason}
        </p>
      )}
    </article>
  );
}

export function TenancyRenewalActions({
  party,
  timeline,
  onSuccess,
}: {
  party: Party;
  timeline: TenancyTimeline;
  onSuccess: (message: string) => void;
}) {
  const { tenancy } = timeline;
  const [mode, setMode] = useState<FormMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const renewalRequests = timeline.renewal_requests ?? [];
  const pendingRenewal = renewalRequests.find((item) => item.status === "PENDING") ?? null;
  const confirmedBasis =
    timeline.contracts.find(
      (contract) => contract.id === tenancy.latest_confirmed_contract_id,
    ) ?? timeline.current_agreement;
  const hasUpcomingRenewal = timeline.upcoming_agreements.some(
    (contract) => contract.type === "RENEWAL",
  );
  const tenantCanRequest =
    party === "tenant" &&
    ["CONFIRMED", "ACTIVE"].includes(tenancy.status) &&
    tenancy.confirmed_end_date !== null &&
    pendingRenewal === null &&
    !hasUpcomingRenewal;

  const relatedRenewals = pendingRenewal
    ? timeline.contracts.filter(
        (contract) => contract.renewal_request_id === pendingRenewal.id,
      )
    : [];
  const previousRenewal = relatedRenewals.at(-1) ?? null;
  const previousExpired =
    previousRenewal !== null &&
    timeline.events.some(
      (event) =>
        event.action === "tenancy.renewal.proposal.expired" &&
        event.correlation_id === previousRenewal.id,
    );
  const canCorrectProposal =
    previousRenewal !== null &&
    previousRenewal.tenant_confirmed_at === null &&
    (previousRenewal.tenant_rejected_at !== null || previousExpired);
  const renewalProposalPending =
    pendingRenewal !== null &&
    timeline.pending_contract?.type === "RENEWAL" &&
    timeline.pending_contract.renewal_request_id === pendingRenewal.id;

  function startForm(nextMode: Exclude<FormMode, null>) {
    setError("");
    setFieldErrors({});
    setAcknowledged(false);
    setMode(nextMode);

    if (nextMode === "proposal" && pendingRenewal) {
      setEndDate(pendingRenewal.requested_end_date.slice(0, 10));
      setRent(String(pendingRenewal.proposed_monthly_rent));
      setDeposit(String(confirmedBasis?.deposit_amount ?? "0"));
    }
  }

  async function submitTenantRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenancy.confirmed_end_date) return;

    setBusy(true);
    setError("");
    setFieldErrors({});

    try {
      await requestTenantTenancyRenewal(tenancy.id, {
        client_operation_id: crypto.randomUUID(),
        requested_end_date: endDate,
        proposed_monthly_rent: Number(rent),
        message: message.trim() || undefined,
      });
      setMode(null);
      onSuccess("Đã gửi yêu cầu gia hạn cho chủ nhà.");
    } catch (caught) {
      setError(errorMessage(caught, "Không thể gửi yêu cầu gia hạn. Vui lòng thử lại."));
      if (caught instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(
            Object.entries(caught.errors).map(([field, messages]) => [field, messages[0]]),
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function withdrawRequest() {
    if (!pendingRenewal || !window.confirm("Bạn có chắc muốn rút yêu cầu gia hạn này?")) return;
    setBusy(true);
    setError("");

    try {
      await withdrawTenantTenancyRenewal(tenancy.id, pendingRenewal.id, {
        client_operation_id: crypto.randomUUID(),
      });
      onSuccess("Đã rút yêu cầu gia hạn.");
    } catch (caught) {
      setError(errorMessage(caught, "Không thể rút yêu cầu gia hạn. Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  }

  async function submitOwnerProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingRenewal || !confirmedBasis || !acknowledged) return;
    setBusy(true);
    setError("");
    setFieldErrors({});

    const input = {
      client_operation_id: crypto.randomUUID(),
      end_date: endDate,
      monthly_rent: Number(rent),
      deposit_amount: Number(deposit),
      policies_snapshot: policiesSnapshot(confirmedBasis),
    };

    try {
      if (canCorrectProposal && previousRenewal) {
        await correctOwnerTenancyRenewal(tenancy.id, pendingRenewal.id, {
          ...input,
          supersedes_contract_id: previousRenewal.id,
        });
      } else {
        await proposeOwnerTenancyRenewal(tenancy.id, pendingRenewal.id, input);
      }
      setMode(null);
      onSuccess("Đã gửi đề xuất gia hạn cho người thuê.");
    } catch (caught) {
      setError(errorMessage(caught, "Không thể gửi đề xuất gia hạn. Vui lòng thử lại."));
      if (caught instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(
            Object.entries(caught.errors).map(([field, messages]) => [field, messages[0]]),
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitOwnerRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingRenewal || reason.trim().length < 5) return;
    setBusy(true);
    setError("");

    try {
      await rejectOwnerTenancyRenewal(tenancy.id, pendingRenewal.id, {
        client_operation_id: crypto.randomUUID(),
        reason: reason.trim(),
      });
      setMode(null);
      onSuccess("Đã từ chối yêu cầu gia hạn và gửi lý do cho người thuê.");
    } catch (caught) {
      setError(errorMessage(caught, "Không thể từ chối yêu cầu gia hạn. Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  }

  if (party === "tenant") {
    if (pendingRenewal) {
      return (
        <div className="space-y-3">
          <RenewalRequestDetails
            renewal={pendingRenewal}
            currentEndDate={tenancy.confirmed_end_date}
            onWithdraw={() => void withdrawRequest()}
            busy={busy}
          />
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        </div>
      );
    }

    if (!tenantCanRequest) return null;

    return (
      <section className="rounded-[15px] border border-[#dde3eb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold leading-[27px] text-[#1b2430]">Gia hạn</h2>
        <p className="mt-3 text-sm leading-5 text-[#5b6676]">
          Kỳ thuê kết thúc {formatDate(tenancy.confirmed_end_date)}. Bạn có thể đề nghị ở tiếp với ngày kết thúc và mức giá mong muốn.
        </p>
        {mode === "request" ? (
          <form className="mt-5 space-y-4" onSubmit={(event) => void submitTenantRequest(event)}>
            <RenewalField label="Ngày kết thúc mong muốn" id="renewal-request-end" value={endDate} onChange={setEndDate} type="date" min={tenancy.confirmed_end_date ? addOneDay(tenancy.confirmed_end_date) : undefined} error={fieldErrors.requested_end_date} />
            <RenewalField label="Giá thuê hàng tháng (₫)" id="renewal-request-rent" value={rent} onChange={setRent} type="number" min={1} error={fieldErrors.proposed_monthly_rent} />
            <div>
              <label htmlFor="renewal-request-message" className="block text-sm font-medium text-slate-700">Lời nhắn (không bắt buộc)</label>
              <textarea id="renewal-request-message" rows={3} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100" />
              <p className="mt-1 text-right text-xs text-slate-500">{message.length}/2.000</p>
            </div>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={busy || !endDate || Number(rent) < 1} className="min-h-11 flex-1 rounded-[15px] border border-black bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang gửi…" : "Gửi yêu cầu gia hạn"}</button>
              <button type="button" onClick={() => setMode(null)} className="min-h-11 rounded-[15px] border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Quay lại</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => startForm("request")} className="mt-5 min-h-11 w-full rounded-[15px] border border-black bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584]">
            Yêu cầu gia hạn
          </button>
        )}
      </section>
    );
  }

  if (!pendingRenewal) return null;

  return (
    <section className="rounded-[15px] border border-[#e1e7ed] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
              Yêu cầu gia hạn · Đang chờ
            </span>
            <time dateTime={pendingRenewal.created_at} className="text-xs text-slate-500">
              Gửi {formatDateTime(pendingRenewal.created_at)}
            </time>
          </div>
          <dl className="mt-3 grid grid-cols-[minmax(120px,0.3fr)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
            <dt className="text-slate-500">Kết thúc hiện tại</dt>
            <dd className="font-medium text-slate-900">{formatDate(tenancy.confirmed_end_date)}</dd>
            <dt className="text-slate-500">Kết thúc yêu cầu</dt>
            <dd className="font-medium text-slate-900">{formatDate(pendingRenewal.requested_end_date)}</dd>
            <dt className="text-slate-500">Giá đề xuất</dt>
            <dd className="font-medium text-slate-900">{formatMoney(pendingRenewal.proposed_monthly_rent)}/tháng</dd>
            {pendingRenewal.message && (
              <>
                <dt className="text-slate-500">Lời nhắn</dt>
                <dd className="whitespace-pre-wrap text-slate-900">{pendingRenewal.message}</dd>
              </>
            )}
          </dl>
          {renewalProposalPending && (
            <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Đề xuất gia hạn phiên bản {timeline.pending_contract?.version_number} đang chờ người thuê xác nhận đến {tenancy.confirmation_expires_at ? formatDateTime(tenancy.confirmation_expires_at) : "—"}.
            </p>
          )}
          {previousRenewal && !renewalProposalPending && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {previousExpired ? "Đề xuất gia hạn trước đã hết hạn." : "Người thuê đã từ chối đề xuất gia hạn trước."} Bạn có thể gửi phiên bản điều chỉnh.
            </p>
          )}
        </div>
        {!renewalProposalPending && mode === null && (
          <div className="flex w-full shrink-0 flex-col gap-2.5 xl:w-60">
            <button type="button" onClick={() => startForm("proposal")} disabled={!confirmedBasis} className="min-h-11 w-full rounded-[15px] border border-black bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:opacity-50">
              {canCorrectProposal ? "Gửi phiên bản điều chỉnh" : "Đề xuất gia hạn"}
            </button>
            <button type="button" onClick={() => startForm("reject")} className="min-h-11 w-full rounded-[15px] border border-[#f1b8b2] bg-white px-5 text-sm font-semibold text-[#b42318] hover:bg-rose-50">
              Từ chối (nhập lý do)
            </button>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {mode === "proposal" && (
        <form className="mt-6 border-t border-slate-100 pt-5" onSubmit={(event) => void submitOwnerProposal(event)}>
          <h3 className="text-base font-bold text-slate-900">{canCorrectProposal ? "Gửi phiên bản gia hạn mới" : "Đề xuất gia hạn"}</h3>
          <p className="mt-1 text-sm text-slate-600">Ngày bắt đầu nối tiếp kỳ thuê hiện tại từ {formatDate(tenancy.confirmed_end_date ? addOneDay(tenancy.confirmed_end_date) : null)}. Người thuê cần xác nhận phiên bản này.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <RenewalField label="Ngày kết thúc đề xuất" id="renewal-owner-end" value={endDate} onChange={setEndDate} type="date" min={tenancy.confirmed_end_date ? addOneDay(tenancy.confirmed_end_date) : undefined} error={fieldErrors.end_date} />
            <RenewalField label="Giá thuê hàng tháng (₫)" id="renewal-owner-rent" value={rent} onChange={setRent} type="number" min={1} error={fieldErrors.monthly_rent} />
            <RenewalField label="Tiền đặt cọc (₫)" id="renewal-owner-deposit" value={deposit} onChange={setDeposit} type="number" min={0} error={fieldErrors.deposit_amount} />
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#3368a0]" />
            <span>Tôi đã kiểm tra các điều khoản gia hạn và muốn gửi phiên bản này cho người thuê xác nhận.</span>
          </label>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMode(null)} className="min-h-11 rounded-[15px] border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Quay lại</button>
            <button type="submit" disabled={busy || !acknowledged || !endDate || Number(rent) < 1 || Number(deposit) < 0} className="min-h-11 rounded-[15px] border border-black bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang gửi…" : "Gửi đề xuất gia hạn"}</button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <form className="mt-6 border-t border-slate-100 pt-5" onSubmit={(event) => void submitOwnerRejection(event)}>
          <label htmlFor="renewal-reject-reason" className="block text-sm font-semibold text-slate-800">Lý do từ chối <span aria-hidden="true">*</span></label>
          <textarea id="renewal-reject-reason" required minLength={5} maxLength={2000} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do (ít nhất 5 ký tự)" className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100" />
          <p className="mt-1 text-sm text-slate-500">Chủ nhà sẽ gửi lý do này cho người thuê.</p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMode(null)} className="min-h-11 rounded-[15px] border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Quay lại</button>
            <button type="submit" disabled={busy || reason.trim().length < 5} className="min-h-11 rounded-[15px] border border-[#b42318] bg-[#b42318] px-5 text-sm font-semibold text-white hover:bg-[#912018] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang gửi…" : "Xác nhận từ chối"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
