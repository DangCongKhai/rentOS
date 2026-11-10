"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  getOwnerTenancies,
  type ParticipantTenancySummary,
} from "@/lib/auth-api";

type TabId =
  "all" | "waiting" | "revision" | "confirmed" | "active" | "history";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "waiting", label: "Chờ người thuê" },
  { id: "revision", label: "Cần sửa đổi" },
  { id: "confirmed", label: "Đã xác nhận" },
  { id: "active", label: "Đang hoạt động" },
  { id: "history", label: "Lịch sử" },
];

const historyStatuses = new Set(["EXPIRED", "CANCELLED", "ENDED"]);

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "vi-VN",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

function formatMoney(value: string | number | null): string {
  if (value === null) return "—";
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

function matchesTab(item: ParticipantTenancySummary, tab: TabId): boolean {
  switch (tab) {
    case "waiting":
      return item.status === "PENDING_CONFIRMATION";
    case "revision":
      return item.status === "AWAITING_REVISION";
    case "confirmed":
      return item.status === "CONFIRMED";
    case "active":
      return item.status === "ACTIVE";
    case "history":
      return historyStatuses.has(item.status);
    default:
      return true;
  }
}

function contractSummary(item: ParticipantTenancySummary) {
  const hasConfirmed = item.latest_confirmed_contract_version !== null;
  const version = hasConfirmed
    ? item.latest_confirmed_contract_version
    : item.pending_contract_version;

  return {
    version,
    proposed: !hasConfirmed && item.pending_contract_version !== null,
    rent: hasConfirmed
      ? item.latest_confirmed_contract_monthly_rent
      : item.pending_contract_monthly_rent,
    deposit: hasConfirmed
      ? item.latest_confirmed_contract_deposit_amount
      : item.pending_contract_deposit_amount,
    start:
      item.confirmed_start_date ??
      item.blocked_start_date ??
      (hasConfirmed
        ? item.latest_confirmed_contract_start_date
        : item.pending_contract_start_date),
    end:
      item.confirmed_end_date ??
      item.blocked_end_date ??
      (hasConfirmed
        ? item.latest_confirmed_contract_end_date
        : item.pending_contract_end_date),
  };
}

export default function OwnerTenanciesPage() {
  const router = useRouter();
  const [tenancies, setTenancies] = useState<ParticipantTenancySummary[]>([]);
  const [tab, setTab] = useState<TabId>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await getOwnerTenancies();
        if (active) setTenancies(result);
      } catch (caught) {
        if (!active) return;

        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }

        setError(
          caught instanceof ApiError
            ? caught.message
            : "Không thể tải danh sách kỳ thuê. Vui lòng thử lại.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [retry, router]);

  const visible = tenancies.filter((item) => matchesTab(item, tab));

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-1 py-4 sm:px-2 sm:py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Kỳ thuê và hợp đồng
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Theo dõi đề xuất, thời hạn thuê và phiên bản hợp đồng của từng căn.
        </p>
      </header>

      <nav
        aria-label="Lọc kỳ thuê"
        className="flex flex-wrap gap-2 border-b border-slate-200"
      >
        {tabs.map((item) => {
          const count = tenancies.filter((tenancy) =>
            matchesTab(tenancy, item.id),
          ).length;
          const selected = tab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={selected ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${
                selected
                  ? "border-[#3368a0] text-[#285584]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
          <button
            type="button"
            className="ml-3 font-semibold underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div
          aria-busy="true"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
        >
          Đang tải kỳ thuê…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-800">
            Không có kỳ thuê trong mục này.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-4">Căn</th>
                  <th className="px-4 py-4">Người thuê</th>
                  <th className="px-4 py-4">Dọn vào</th>
                  <th className="px-4 py-4">Dọn ra</th>
                  <th className="px-4 py-4">Hợp đồng</th>
                  <th className="px-4 py-4">Trạng thái</th>
                  <th className="px-4 py-4">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visible.map((item) => {
                  const contract = contractSummary(item);

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {item.unit_label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.property_name}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-slate-800">
                        {item.counterparty_name}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-slate-800">
                        {formatDate(contract.start)}
                        {contract.proposed && (
                          <p className="mt-1 text-xs text-slate-500">
                            Theo đề xuất
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-slate-800">
                        {formatDate(contract.end)}
                        {contract.proposed && (
                          <p className="mt-1 text-xs text-slate-500">
                            Theo đề xuất
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-800">
                        {contract.version !== null ? (
                          <>
                            <p className="font-semibold">
                              Phiên bản {contract.version}
                              {contract.proposed ? " · chờ xác nhận" : ""}
                            </p>
                            <p className="mt-1">
                              {formatMoney(contract.rent)}/tháng
                            </p>
                            <p className="text-slate-500">
                              Cọc {formatMoney(contract.deposit)}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-500">
                            Chưa có hợp đồng
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/owner/tenancies/${encodeURIComponent(item.id)}`}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Xem hợp đồng
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
