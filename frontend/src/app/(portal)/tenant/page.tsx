"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  getTenantTenancies,
  type TenantTenancy,
} from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { PortalEmptyState } from "@/components/portal-empty-state";

export default function TenantPortalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tenancies, setTenancies] = useState<TenantTenancy[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const data = await getTenantTenancies();
        if (!ignore) {
          setTenancies(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (ignore) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(
          "Không thể tải thông tin hợp đồng thuê. Vui lòng thử lại sau.",
        );
        setLoading(false);
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [router, retryKey]);

  const handleRetry = () => {
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="mb-8">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          CỔNG CƯ DÂN
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
          Quản lý cuộc sống thuê nhà
        </h1>
        <p className="text-sm text-slate-600">
          Theo dõi hợp đồng, thanh toán tiền phòng và gửi yêu cầu hỗ trợ dịch vụ
          tiện ích.
        </p>
      </div>

      {loading ? (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Đang tải thông tin cư dân"
        >
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-3">
            <div className="h-5 w-32 bg-blue-100 rounded-full" />
            <div className="h-7 w-64 bg-slate-200 rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-slate-100 rounded" />
            <div className="h-6 w-36 bg-slate-100 rounded-lg mt-2" />
          </div>
          <div className="space-y-4">
            <div className="h-24 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" />
            <div className="h-24 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" />
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-10 px-4 bg-white border border-rose-200 rounded-2xl p-8 max-w-xl mx-auto shadow-sm">
          <p className="text-sm text-rose-600 font-medium mb-4">{error}</p>
          <button
            type="button"
            className="inline-flex items-center justify-center min-h-[42px] px-5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors"
            onClick={handleRetry}
          >
            Thử lại
          </button>
        </div>
      ) : tenancies && tenancies.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#3368a0] mb-3">
              Cư dân chính thức
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              Hợp đồng thuê của bạn
            </h2>
            <p className="text-sm text-slate-600">
              Chào mừng bạn, <strong>{user?.name}</strong>. Dưới đây là danh
              sách các hợp đồng thuê nhà thực tế của bạn trên hệ thống rentOS.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
              <span>Tổng số hợp đồng:</span>
              <strong className="text-slate-900">{tenancies.length}</strong>
            </div>
          </div>

          <div className="space-y-4">
            {tenancies.map((tenancy) => {
              const isActive = tenancy.status === "ACTIVE";
              const isConfirmed = tenancy.status === "CONFIRMED";
              const statusLabel = isActive
                ? "Đang hoạt động"
                : isConfirmed
                  ? "Đã xác nhận"
                  : tenancy.status;
              const badgeClass = isActive
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : isConfirmed
                  ? "bg-blue-50 text-blue-800 border-blue-300"
                  : "bg-slate-100 text-slate-700 border-slate-300";

              return (
                <div
                  key={tenancy.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900">
                        Hợp đồng #{tenancy.id.slice(0, 8)}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400">Ngày bắt đầu: </span>
                        <span className="font-medium text-slate-700">
                          {tenancy.confirmed_start_date ?? "Chưa ấn định"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Ngày kết thúc: </span>
                        <span className="font-medium text-slate-700">
                          {tenancy.confirmed_end_date ?? "Không thời hạn"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors"
                      href={`/tenant/tenancies/${encodeURIComponent(tenancy.id)}`}
                    >
                      Xem đề xuất và hợp đồng
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <Link
              className="inline-flex items-center justify-center min-h-[42px] px-5 py-2 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors"
              href="/"
            >
              Khám phá thêm căn hộ
            </Link>
          </div>
        </div>
      ) : (
        <PortalEmptyState
          kicker="CHƯA CÓ HỢP ĐỒNG"
          title="Bạn chưa có hợp đồng thuê nhà nào"
          description="Tìm kiếm không gian sống lý tưởng trong danh mục phòng cho thuê đã được xác thực của chúng tôi và gửi yêu cầu thuê ngay hôm nay."
          ctaHref="/"
          ctaText="Tìm nơi ở phù hợp"
        />
      )}
    </div>
  );
}
