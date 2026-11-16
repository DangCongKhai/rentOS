"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  getTenantTenancies,
  type TenantTenancy,
} from "@/lib/auth-api";

function tenancyStatusLabel(status: string): string {
  switch (status) {
    case "PENDING_CONFIRMATION":
      return "Chờ bạn xác nhận";
    case "AWAITING_REVISION":
      return "Chờ chủ nhà gửi phiên bản mới";
    case "CONFIRMED":
      return "Đã xác nhận";
    case "ACTIVE":
      return "Đang thuê";
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

function tenancyStatusClass(status: string): string {
  switch (status) {
    case "PENDING_CONFIRMATION":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "AWAITING_REVISION":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "CONFIRMED":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa xác định";

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "vi-VN",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

function formatMoney(value: string | number | null): string {
  if (value === null) return "Chưa xác định";

  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

export default function TenantContractsPage() {
  const router = useRouter();
  const [tenancies, setTenancies] = useState<TenantTenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const result = await getTenantTenancies();
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
            : "Không thể tải đề xuất và hợp đồng. Vui lòng thử lại.",
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

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          CỔNG CƯ DÂN
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Căn hộ và hợp đồng
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Xem các đề xuất thuê, phản hồi hợp đồng và theo dõi kỳ thuê của bạn.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((value) => value + 1);
            }}
            className="ml-3 font-semibold underline"
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
          Đang tải đề xuất và hợp đồng…
        </div>
      ) : tenancies.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            Chưa có đề xuất hoặc hợp đồng thuê
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            Khi chủ nhà gửi đề xuất thuê, thông tin sẽ xuất hiện tại đây để bạn
            xem và phản hồi.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584]"
          >
            Tìm nơi ở
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-4">Căn</th>
                  <th className="px-5 py-4">Bất động sản</th>
                  <th className="px-5 py-4">Dọn vào</th>
                  <th className="px-5 py-4">Dọn ra</th>
                  <th className="px-5 py-4">Hợp đồng</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenancies.map((tenancy) => {
                  const hasPendingContract = tenancy.pending_contract_version !== null;
                  const startDate =
                    tenancy.pending_contract_start_date ??
                    tenancy.confirmed_start_date ??
                    tenancy.blocked_start_date;
                  const endDate =
                    tenancy.pending_contract_end_date ??
                    tenancy.confirmed_end_date ??
                    tenancy.blocked_end_date;
                  const rent =
                    tenancy.pending_contract_monthly_rent ??
                    tenancy.latest_confirmed_contract_monthly_rent;
                  const deposit =
                    tenancy.pending_contract_deposit_amount ??
                    tenancy.latest_confirmed_contract_deposit_amount;

                  return (
                    <tr key={tenancy.id} className="align-top text-slate-800">
                      <td className="px-5 py-5 font-semibold">
                        {tenancy.unit_label}
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-medium">{tenancy.property_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {tenancy.counterparty_name}
                          {tenancy.property_city
                            ? ` · ${tenancy.property_city}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-5 py-5">{formatDate(startDate)}</td>
                      <td className="px-5 py-5">{formatDate(endDate)}</td>
                      <td className="px-5 py-5">
                        {hasPendingContract ? (
                          <>
                            <p className="font-semibold">
                              Phiên bản {tenancy.pending_contract_version}
                            </p>
                            <p className="mt-1">{formatMoney(rent)}/tháng</p>
                            <p className="text-xs text-slate-500">
                              Cọc {formatMoney(deposit)}
                            </p>
                          </>
                        ) : tenancy.latest_confirmed_contract_version !== null ? (
                          <>
                            <p className="font-semibold">
                              Phiên bản {tenancy.latest_confirmed_contract_version}
                            </p>
                            <p className="mt-1">{formatMoney(rent)}/tháng</p>
                            <p className="text-xs text-slate-500">
                              Cọc {formatMoney(deposit)}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-500">
                            Chưa có hợp đồng
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tenancyStatusClass(tenancy.status)}`}
                        >
                          {tenancyStatusLabel(tenancy.status)}
                        </span>
                        {hasPendingContract && tenancy.confirmation_expires_at && (
                          <p className="mt-2 text-xs text-slate-500">
                            Phản hồi trước {formatDate(tenancy.confirmation_expires_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-5 text-right">
                        <Link
                          href={`/tenant/tenancies/${encodeURIComponent(tenancy.id)}`}
                          className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-slate-300 px-4 text-sm font-semibold text-[#285584] hover:bg-slate-50"
                        >
                          {hasPendingContract ? "Xem đề xuất" : "Xem hợp đồng"}
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
