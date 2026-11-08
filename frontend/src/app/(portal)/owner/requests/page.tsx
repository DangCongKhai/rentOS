"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  getOwnerRentalRequests,
  type OwnerRentalRequestSummary,
} from "@/lib/auth-api";

const tabs = [
  { status: "PENDING", label: "Đang chờ" },
  { status: "ACCEPTED", label: "Đã chấp nhận" },
  { status: "REJECTED", label: "Đã từ chối" },
  { status: "WITHDRAWN", label: "Đã rút lại" },
] as const;

function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "vi-VN",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

function daysWaiting(value: string): string {
  const created = new Date(value).getTime();
  const days = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));

  return days === 0 ? "Hôm nay" : `${days} ngày`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Đang chờ xử lý";
    case "ACCEPTED":
      return "Đã chấp nhận";
    case "REJECTED":
      return "Đã từ chối";
    case "WITHDRAWN":
      return "Đã rút lại";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-900";
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-900";
    case "REJECTED":
    case "WITHDRAWN":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function OwnerRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<OwnerRentalRequestSummary[]>([]);
  const [activeStatus, setActiveStatus] =
    useState<(typeof tabs)[number]["status"]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadRequests() {
      setLoading(true);
      setError("");

      try {
        const result = await getOwnerRentalRequests();
        if (active) setRequests(result);
      } catch (caught) {
        if (!active) return;

        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }

        setError(
          caught instanceof ApiError
            ? caught.message
            : "Không thể tải yêu cầu thuê. Vui lòng thử lại.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRequests();

    return () => {
      active = false;
    };
  }, [retry, router]);

  const visibleRequests = requests.filter(
    (request) => request.status === activeStatus,
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-1 py-4 sm:px-2 sm:py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Yêu cầu thuê
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Theo dõi yêu cầu và gửi đề xuất kỳ thuê cho người thuê.
        </p>
      </header>

      <nav
        aria-label="Lọc yêu cầu thuê"
        className="mb-4 flex flex-wrap gap-2 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const count = requests.filter(
            (request) => request.status === tab.status,
          ).length;
          const selected = activeStatus === tab.status;

          return (
            <button
              key={tab.status}
              type="button"
              onClick={() => setActiveStatus(tab.status)}
              aria-current={selected ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${
                selected
                  ? "border-[#3368a0] text-[#285584]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
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
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
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
          Đang tải yêu cầu thuê…
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-800">
            Không có yêu cầu thuê trong mục này.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Yêu cầu mới sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Người thuê</th>
                  <th className="px-4 py-3">Tin đăng · căn ưu tiên</th>
                  <th className="px-4 py-3">Ngày mong muốn</th>
                  <th className="px-4 py-3">Đã chờ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRequests.map((request) => (
                  <tr key={request.id} className="align-middle">
                    <td className="px-4 py-4">
                      <Link
                        href={`/owner/requests/${request.id}`}
                        className="font-semibold text-slate-900 hover:text-[#285584]"
                      >
                        {request.contact_name}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {request.contact_phone}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">
                        {request.listing_title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ưu tiên:{" "}
                        {request.preferred_unit_label ?? "Không ưu tiên"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {formatDate(request.desired_move_in_date)} –{" "}
                      {formatDate(request.desired_end_date)}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {request.status === "PENDING"
                        ? daysWaiting(request.created_at)
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(request.status)}`}
                      >
                        {statusLabel(request.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
