"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  cancelOwnerTenancy,
  confirmTenantTenancyContract,
  declineTenantTenancyContract,
  endOwnerTenancy,
  markOwnerTenancyMoveIn,
  getOwnerTenancyTimeline,
  getTenantTenancyTimeline,
  type TenancyContractRecord,
  type TenancyTimeline,
} from "@/lib/auth-api";

type Party = "owner" | "tenant";

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "vi-VN",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function todayInVietnam(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatMoney(value: string | number): string {
  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING_CONFIRMATION":
      return "Chờ người thuê xác nhận";
    case "AWAITING_REVISION":
      return "Cần gửi phiên bản mới";
    case "CONFIRMED":
      return "Đã xác nhận";
    case "ACTIVE":
      return "Đang hoạt động";
    case "EXPIRED":
      return "Đã hết hạn";
    case "CANCELLED":
      return "Đã hủy";
    case "ENDED":
      return "Đã kết thúc";
    default:
      return status;
  }
}

function eventLabel(action: string): string {
  const labels: Record<string, string> = {
    "tenancy.proposed": "Chủ nhà đã gửi đề xuất thuê",
    "tenancy.contract.confirmed": "Người thuê đã xác nhận hợp đồng",
    "tenancy.contract.declined": "Người thuê đã từ chối hợp đồng",
    "tenancy.contract.corrected": "Chủ nhà đã gửi phiên bản hợp đồng mới",
    "tenancy.moved_in": "Đã ghi nhận ngày nhận nhà",
    "tenancy.cancelled": "Kỳ thuê đã bị hủy",
    "tenancy.ended": "Kỳ thuê đã kết thúc",
  };

  return labels[action] ?? action;
}

function statusClass(status: string): string {
  switch (status) {
    case "PENDING_CONFIRMATION":
      return "bg-amber-100 text-amber-900";
    case "AWAITING_REVISION":
      return "bg-orange-100 text-orange-900";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-900";
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function readPolicySnapshot(
  snapshot: TenancyContractRecord["policies_snapshot"],
) {
  let value: unknown = snapshot;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const root = value as Record<string, unknown>;
  const property =
    root.property && typeof root.property === "object"
      ? (root.property as Record<string, unknown>)
      : {};
  const unit =
    root.unit && typeof root.unit === "object"
      ? (root.unit as Record<string, unknown>)
      : {};

  const sharedRules = Array.isArray(property.shared_rules)
    ? property.shared_rules.filter(
        (rule): rule is string => typeof rule === "string",
      )
    : [];
  const unitRules = Array.isArray(unit.additional_rules)
    ? unit.additional_rules.filter(
        (rule): rule is string => typeof rule === "string",
      )
    : [];

  return {
    pets: String(unit.pets ?? property.pets ?? "Chưa có"),
    smoking: String(unit.smoking ?? property.smoking ?? "Chưa có"),
    rules: [...new Set([...sharedRules, ...unitRules])],
  };
}

function ContractCard({
  contract,
  title,
}: {
  contract: TenancyContractRecord;
  title: string;
}) {
  const policies = readPolicySnapshot(contract.policies_snapshot);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Phiên bản {contract.version_number} ·{" "}
            {contract.type === "ORIGINAL" ? "Bản gốc" : contract.type}
          </p>
        </div>

      </div>

      <dl className="mt-5 grid grid-cols-[125px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
        <dt className="text-slate-500">Thời hạn</dt>
        <dd className="text-slate-800">
          {formatDate(contract.start_date)} – {formatDate(contract.end_date)}
        </dd>

        <dt className="text-slate-500">Giá thuê tháng</dt>
        <dd className="font-semibold text-[#285584]">
          {formatMoney(contract.monthly_rent)}/tháng
        </dd>

        <dt className="text-slate-500">Tiền cọc</dt>
        <dd className="text-slate-800">
          {formatMoney(contract.deposit_amount)}
        </dd>

        <dt className="text-slate-500">Chủ nhà</dt>
        <dd className="text-slate-800">
          {contract.owner_confirmed_at
            ? `Đã xác nhận · ${formatDateTime(contract.owner_confirmed_at)}`
            : "Chưa xác nhận"}
        </dd>

        <dt className="text-slate-500">Người thuê</dt>
        <dd className="text-slate-800">
          {contract.tenant_confirmed_at
            ? `Đã xác nhận · ${formatDateTime(contract.tenant_confirmed_at)}`
            : contract.tenant_rejected_at
              ? `Đã từ chối · ${formatDateTime(contract.tenant_rejected_at)}`
              : "Chưa xác nhận"}
        </dd>

        {contract.tenant_rejection_reason && (
          <>
            <dt className="text-slate-500">Lý do từ chối</dt>
            <dd className="whitespace-pre-wrap text-slate-800">
              {contract.tenant_rejection_reason}
            </dd>
          </>
        )}
      </dl>

      {policies && (
        <dl className="mt-5 grid grid-cols-[125px_minmax(0,1fr)] gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
          <dt className="text-slate-500">Thú cưng</dt>
          <dd className="text-slate-800">{policies.pets}</dd>

          <dt className="text-slate-500">Hút thuốc</dt>
          <dd className="text-slate-800">{policies.smoking}</dd>

          <dt className="text-slate-500">Nội quy</dt>
          <dd className="text-slate-800">
            {policies.rules.length
              ? policies.rules.join(" · ")
              : "Không có nội quy bổ sung"}
          </dd>
        </dl>
      )}

    </article>
  );
}

export function TenancyTimelinePage({ party }: { party: Party }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [timeline, setTimeline] = useState<TenancyTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const [decisionLoading, setDecisionLoading] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result =
          party === "owner"
            ? await getOwnerTenancyTimeline(id)
            : await getTenantTenancyTimeline(id);

        if (active) setTimeline(result);
      } catch (caught) {
        if (!active) return;

        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }

        setError(
          caught instanceof ApiError
            ? caught.message
            : "Không thể tải lịch sử kỳ thuê. Vui lòng thử lại.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [id, party, retry, router]);

  async function confirmPendingContract() {
    if (!timeline?.pending_contract || party !== "tenant") return;

    setError("");
    setSuccessMessage("");
    setDecisionLoading(true);

    try {
      await confirmTenantTenancyContract(id, timeline.pending_contract.id, {
        client_operation_id: crypto.randomUUID(),
      });

      setSuccessMessage("Bạn đã xác nhận phiên bản hợp đồng này.");
      setRetry((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không thể xác nhận hợp đồng. Vui lòng thử lại.",
      );
    } finally {
      setDecisionLoading(false);
    }
  }

  async function declinePendingContract() {
    if (!timeline?.pending_contract || party !== "tenant") return;

    setError("");
    setSuccessMessage("");
    setDecisionLoading(true);

    try {
      await declineTenantTenancyContract(id, timeline.pending_contract.id, {
        client_operation_id: crypto.randomUUID(),
        reason: declineReason.trim(),
      });

      setDeclineReason("");
      setSuccessMessage("Bạn đã từ chối phiên bản hợp đồng này.");
      setRetry((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không thể từ chối hợp đồng. Vui lòng thử lại.",
      );
    } finally {
      setDecisionLoading(false);
    }
  }

  async function markMoveIn() {
    if (party !== "owner") return;

    setError("");
    setSuccessMessage("");
    setLifecycleLoading(true);

    try {
      await markOwnerTenancyMoveIn(id, {
        client_operation_id: crypto.randomUUID(),
      });

      setSuccessMessage("Đã ghi nhận ngày nhận nhà.");
      setRetry((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không thể ghi nhận ngày nhận nhà. Vui lòng thử lại.",
      );
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function closeTenancy(transition: "cancel" | "end") {
    if (party !== "owner" || closeReason.trim().length < 5) return;

    const confirmed = window.confirm(
      transition === "cancel"
        ? "Bạn có chắc muốn hủy kỳ thuê này?"
        : "Bạn có chắc muốn ghi nhận kỳ thuê đã kết thúc?",
    );

    if (!confirmed) return;

    setError("");
    setSuccessMessage("");
    setCloseLoading(true);

    try {
      const input = {
        client_operation_id: crypto.randomUUID(),
        reason: closeReason.trim(),
      };

      if (transition === "cancel") {
        await cancelOwnerTenancy(id, input);
        setSuccessMessage("Đã hủy kỳ thuê.");
      } else {
        await endOwnerTenancy(id, input);
        setSuccessMessage("Đã ghi nhận kỳ thuê kết thúc.");
      }

      setCloseReason("");
      setRetry((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không thể cập nhật kỳ thuê. Vui lòng thử lại.",
      );
    } finally {
      setCloseLoading(false);
    }
  }

  const listHref = party === "owner" ? "/owner/tenancies" : "/tenant";

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-1 py-6">
        <div
          aria-busy="true"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
        >
          Đang tải lịch sử kỳ thuê…
        </div>
      </section>
    );
  }

  if (!timeline) {
    return (
      <section className="mx-auto w-full max-w-6xl px-1 py-6">
        <Link
          href={listHref}
          className="text-sm font-semibold text-[#285584] hover:underline"
        >
          ← Quay lại
        </Link>
        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error || "Không tìm thấy kỳ thuê."}
          {error && (
            <button
              type="button"
              className="ml-3 font-semibold underline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Thử lại
            </button>
          )}
        </div>
      </section>
    );
  }

  const { tenancy } = timeline;
  const title =
    party === "owner"
      ? (timeline.rental_request?.contact_name ??
        timeline.participants.tenant_name)
      : timeline.property.name;
  const address = [
    timeline.property.address_line,
    timeline.property.ward,
    timeline.property.city,
  ]
    .filter(Boolean)
    .join(", ");
  const currentContract = timeline.current_agreement;
  const pendingContract = timeline.pending_contract;
  const latestContract = timeline.contracts[timeline.contracts.length - 1];
  const canCorrect =
    party === "owner" &&
    tenancy.status === "AWAITING_REVISION" &&
    latestContract?.type === "ORIGINAL" &&
    latestContract.tenant_rejected_at !== null &&
    latestContract.tenant_confirmed_at === null;
  const canCancel =
    party === "owner" &&
    tenancy.status === "CONFIRMED" &&
    tenancy.moved_in_at === null &&
    tenancy.confirmed_start_date !== null &&
    tenancy.confirmed_start_date > todayInVietnam();
  const canEnd =
    party === "owner" &&
    tenancy.status === "ACTIVE" &&
    tenancy.moved_in_at !== null;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-1 py-4 sm:px-2 sm:py-6">
      <Link
        href={listHref}
        className="text-sm font-semibold text-[#3368a0] hover:underline"
      >
        ← {party === "owner" ? "Kỳ thuê và hợp đồng" : "Căn hộ và hợp đồng"}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-[28px]">
            {timeline.unit.label} · {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {address || timeline.property.name}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass(tenancy.status)}`}
        >
          {statusLabel(tenancy.status)}
        </span>
      </header>

      {pendingContract && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-slate-900">
            Phiên bản {pendingContract.version_number} đang chờ xác nhận
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Hạn phản hồi: {formatDateTime(tenancy.confirmation_expires_at)}
          </p>
        </section>
      )}

      {canCorrect && latestContract && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">
              Người thuê đã từ chối phiên bản {latestContract.version_number}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Cập nhật điều khoản và gửi một phiên bản hợp đồng mới để xác nhận.
            </p>
          </div>
          <Link
            href={`/owner/tenancies/${encodeURIComponent(id)}/correction`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584]"
          >
            Tạo phiên bản mới
          </Link>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      {successMessage && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {successMessage}
        </p>
      )}

      {party === "tenant" &&
        pendingContract &&
        tenancy.pending_contract_id === pendingContract.id &&
        tenancy.status === "PENDING_CONFIRMATION" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Xác nhận phiên bản {pendingContract.version_number}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Vui lòng kiểm tra thời hạn, giá thuê, tiền cọc và các quy định
              dưới đây trước khi phản hồi phiên bản này.
            </p>

            <label
              htmlFor="decline-reason"
              className="mt-5 block text-sm font-semibold text-slate-800"
            >
              Lý do từ chối
            </label>
            <textarea
              id="decline-reason"
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              minLength={5}
              maxLength={2000}
              rows={3}
              placeholder="Nhập lý do (ít nhất 5 ký tự)"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => void declinePendingContract()}
                disabled={decisionLoading || declineReason.trim().length < 5}
                className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {decisionLoading ? "Đang gửi…" : "Từ chối"}
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingContract()}
                disabled={decisionLoading}
                className="min-h-11 rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {decisionLoading ? "Đang gửi…" : "Xác nhận hợp đồng"}
              </button>
            </div>
          </section>
        )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {currentContract ? (
            <ContractCard
              contract={currentContract}
              title="Điều khoản đã xác nhận"
            />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900">
                Điều khoản đã xác nhận
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Chưa có phiên bản hợp đồng được hai bên xác nhận.
              </p>
            </section>
          )}

          {pendingContract && (
            <ContractCard
              contract={pendingContract}
              title="Phiên bản đang chờ xác nhận"
            />
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Lịch sử hợp đồng
            </h2>
            <div className="space-y-3">
              {timeline.contracts.map((contract) => {
                const supersededContract = timeline.contracts.find(
                  (item) => item.id === contract.supersedes_contract_id,
                );

                return (
                  <article
                    key={contract.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        Phiên bản {contract.version_number} · {contract.type}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(contract.start_date)} –{" "}
                        {formatDate(contract.end_date)} ·{" "}
                        {formatMoney(contract.monthly_rent)}/tháng
                      </p>

                      {contract.supersedes_contract_id && (
                        <p className="mt-1 text-xs text-slate-500">
                          Thay thế phiên bản{" "}
                          {supersededContract?.version_number ?? "trước đó"}
                        </p>
                      )}
                    </div>

                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Diễn biến kỳ thuê
            </h2>

            {timeline.events.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có diễn biến nào.</p>
            ) : (
              <ol className="space-y-4">
                {timeline.events.map((event, index) => (
                  <li
                    key={`${event.action}-${event.created_at}-${index}`}
                    className="relative border-l border-slate-200 pb-1 pl-5 last:border-l-transparent"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-[#3368a0]"
                    />
                    <p className="font-semibold text-slate-900">
                      {eventLabel(event.action)}
                    </p>
                    <time
                      dateTime={event.created_at}
                      className="mt-1 block text-xs text-slate-500"
                    >
                      {formatDateTime(event.created_at)}
                    </time>
                    {event.reason && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {event.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">
            {party === "owner" ? "Thông tin người thuê" : "Thông tin chủ nhà"}
          </h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">
                {party === "owner" ? "Người thuê" : "Chủ nhà"}
              </dt>
              <dd className="font-semibold text-slate-900">
                {party === "owner"
                  ? (timeline.rental_request?.contact_name ??
                    timeline.participants.tenant_name)
                  : timeline.participants.owner_name}
              </dd>
            </div>

            {party === "owner" && timeline.rental_request?.contact_phone && (
              <div>
                <dt className="text-slate-500">Điện thoại</dt>
                <dd>
                  <a
                    href={`tel:${timeline.rental_request.contact_phone}`}
                    className="font-semibold text-[#285584] hover:underline"
                  >
                    {timeline.rental_request.contact_phone}
                  </a>
                </dd>
              </div>
            )}

            <div>
              <dt className="text-slate-500">Bất động sản</dt>
              <dd className="text-slate-800">{timeline.property.name}</dd>
            </div>

            <div>
              <dt className="text-slate-500">Căn</dt>
              <dd className="text-slate-800">{timeline.unit.label}</dd>
            </div>
          </dl>

          {party === "owner" && tenancy.status === "CONFIRMED" && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                Ghi nhận khi người thuê đã thực tế nhận căn hộ.
              </p>
              <button
                type="button"
                onClick={() => void markMoveIn()}
                disabled={lifecycleLoading}
                className="mt-3 min-h-11 w-full rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lifecycleLoading ? "Đang cập nhật…" : "Xác nhận nhận nhà"}
              </button>
            </div>
          )}

          {(canCancel || canEnd) && (
            <div className="border-t border-slate-100 pt-4">
              <label
                htmlFor="tenancy-close-reason"
                className="block text-sm font-semibold text-slate-800"
              >
                {canCancel ? "Lý do hủy kỳ thuê" : "Lý do kết thúc kỳ thuê"}
              </label>
              <textarea
                id="tenancy-close-reason"
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
                minLength={5}
                maxLength={2000}
                rows={3}
                placeholder="Nhập lý do (ít nhất 5 ký tự)"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => void closeTenancy(canCancel ? "cancel" : "end")}
                disabled={closeLoading || closeReason.trim().length < 5}
                className="mt-3 min-h-11 w-full rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closeLoading
                  ? "Đang cập nhật…"
                  : canCancel
                    ? "Hủy kỳ thuê"
                    : "Ghi nhận kết thúc"}
              </button>
            </div>
          )}

          {pendingContract && party === "owner" && (
            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
              Người thuê cần xác nhận đúng phiên bản hợp đồng này trước hạn.
            </p>
          )}

          {pendingContract && party === "tenant" && (
            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
              Hãy kiểm tra các điều khoản hiển thị ở trên của phiên bản đang
              chờ xác nhận.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
