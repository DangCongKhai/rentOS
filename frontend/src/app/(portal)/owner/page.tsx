"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getOwnerProperties, type OwnerProperty } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { PortalEmptyState } from "@/components/portal-empty-state";

function propertyTypeLabel(value: string): string {
  return value === "HOUSE" ? "Nhà" : value === "APARTMENT_BUILDING" ? "Tòa căn hộ" : value === "APARTMENT" ? "Căn hộ" : value;
}

function rentalArrangementLabel(value: string): string {
  return value === "WHOLE_SPACE" ? "Thuê nguyên căn" : value === "SEPARATE_UNITS" ? "Thuê theo phòng" : value;
}

export default function OwnerPortalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [properties, setProperties] = useState<OwnerProperty[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const data = await getOwnerProperties();
        if (!ignore) {
          setProperties(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (ignore) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError("Không thể tải thông tin bất động sản. Vui lòng thử lại sau.");
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
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">CỔNG CHỦ NHÀ</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">Quản lý tài sản và người thuê</h1>
        <p className="text-sm text-slate-600">Kiểm soát danh mục căn hộ cho thuê, xét duyệt hợp đồng và tối ưu hóa doanh thu bất động sản.</p>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Đang tải thông tin chủ nhà">
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
      ) : properties && properties.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#3368a0] mb-3">
              Chủ nhà đối tác
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Danh mục bất động sản của bạn</h2>
            <p className="text-sm text-slate-600">
              Xin chào, <strong>{user?.name}</strong>. Dưới đây là danh sách các bất động sản thực tế bạn đang quản lý trên rentOS.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
              <span>Tổng số bất động sản:</span>
              <strong className="text-slate-900">{properties.length}</strong>
            </div>
          </div>

          <div className="space-y-4">
            {properties.map((property) => {
              const isArchived = Boolean(property.archived_at);
              const statusLabel = isArchived ? "Đã lưu trữ" : "Đang hoạt động";
              const badgeClass = isArchived
                ? "bg-slate-100 text-slate-700 border-slate-300"
                : "bg-emerald-50 text-emerald-800 border-emerald-300";

              return (
                <div
                  key={property.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900">
                        {property.name}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400">Khu vực: </span>
                        <span className="font-medium text-slate-700">{property.city}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Loại hình: </span>
                        <span className="font-medium text-slate-700">{propertyTypeLabel(property.property_type)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Hình thức: </span>
                        <span className="font-medium text-slate-700">{rentalArrangementLabel(property.rental_arrangement)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors"
                      href="/"
                    >
                      Quản lý phòng
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
              Xem danh sách căn hộ
            </Link>
          </div>
        </div>
      ) : (
        <PortalEmptyState
          kicker="CHƯA CÓ BẤT ĐỘNG SẢN"
          title="Bạn chưa có bất động sản nào"
          description="Đăng tin cho thuê nhà hoặc căn hộ của bạn để tiếp cận hàng nghìn người thuê tiềm năng và quản lý hợp đồng chuyên nghiệp."
          ctaHref="/"
          ctaText="Bắt đầu đăng tin"
        />
      )}
    </div>
  );
}
