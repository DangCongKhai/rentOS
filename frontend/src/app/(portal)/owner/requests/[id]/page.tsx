"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  getOwnerRentalRequest,
  type OwnerRentalRequestDetail,
} from "@/lib/auth-api";

function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "vi-VN",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
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

export default function OwnerRentalRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<OwnerRentalRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadRequest() {
      setLoading(true);
      setError("");

      try {
        const result = await getOwnerRentalRequest(id);
        if (active) setDetail(result);
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

    void loadRequest();

    return () => {
      active = false;
    };
  }, [id, retry, router]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-1 py-6">
        <div
          aria-busy="true"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
        >
          Đang tải yêu cầu thuê…
        </div>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="mx-auto w-full max-w-6xl px-1 py-6">
        <Link
          href="/owner/requests"
          className="text-sm font-semibold text-[#285584] hover:underline"
        >
          ← Danh sách yêu cầu thuê
        </Link>

        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error || "Không tìm thấy yêu cầu thuê."}
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

  const request = detail.request;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-1 py-4 sm:px-2 sm:py-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/owner/requests"
          className="font-semibold text-[#3368a0] hover:underline"
        >
          Yêu cầu thuê
        </Link>
        <span aria-hidden="true" className="text-slate-400">
          /
        </span>
        <span className="text-slate-500">{request.listing_title}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {request.contact_name}
        </h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          {statusLabel(request.status)}
        </span>
      </header>

      {request.status === "PENDING" && (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
          Hãy gọi cho người thuê để trao đổi. Việc xem nhà và thương lượng diễn
          ra ngoài ứng dụng rentOS. Yêu cầu chuyển sang “Đã chấp nhận” khi bạn
          gửi đề xuất kỳ thuê.
        </p>
      )}

      {request.status !== "PENDING" && request.outcome_reason && (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Lý do đóng yêu cầu: {request.outcome_reason}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div>
              <p className="text-sm text-slate-500">Liên hệ</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {request.contact_name}
              </p>
              <p className="text-lg font-semibold text-[#285584]">
                {request.contact_phone}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Thông tin liên hệ được lưu tại thời điểm gửi yêu cầu.
              </p>
            </div>

            <a
              href={`tel:${request.contact_phone}`}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584]"
            >
              Gọi người thuê
            </a>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Yêu cầu</h2>

            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
              <dt className="text-slate-500">Tin đăng</dt>
              <dd className="font-medium text-slate-800">
                {request.listing_title}
              </dd>

              <dt className="text-slate-500">Bất động sản</dt>
              <dd className="text-slate-800">
                {request.property_name}
                {request.city ? ` · ${request.city}` : ""}
              </dd>

              <dt className="text-slate-500">Ngày thuê</dt>
              <dd className="text-slate-800">
                {formatDate(request.desired_move_in_date)} –{" "}
                {formatDate(request.desired_end_date)}
              </dd>

              <dt className="text-slate-500">Căn ưu tiên</dt>
              <dd className="text-slate-800">
                {request.preferred_unit_label ?? "Không ưu tiên"}
              </dd>

              <dt className="text-slate-500">Lời nhắn</dt>
              <dd className="whitespace-pre-wrap text-slate-800">
                {request.message}
              </dd>

              <dt className="text-slate-500">Ngày gửi</dt>
              <dd className="text-slate-800">
                {formatDate(request.created_at)}
              </dd>
            </dl>
          </section>
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">Hành động</h2>

          {request.status === "PENDING" ? (
            <Link
              href={`/owner/requests/${encodeURIComponent(request.id)}/proposal`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584]"
            >
              Tạo đề xuất kỳ thuê
            </Link>
          ) : request.tenancy_id ? (
            <Link
              href={`/owner/tenancies/${encodeURIComponent(request.tenancy_id)}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Xem kỳ thuê
            </Link>
          ) : (
            <p className="text-sm text-slate-600">Yêu cầu này đã được đóng.</p>
          )}

          <p className="text-xs leading-5 text-slate-500">
            Không có thao tác “Chấp nhận” riêng. Gửi đề xuất sẽ tạo kỳ thuê và
            chuyển yêu cầu sang trạng thái đã chấp nhận.
          </p>
        </aside>
      </div>
    </section>
  );
}
