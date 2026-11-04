"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getOwnerListing,
  getOwnerProperties,
  getOwnerProperty,
  type OwnerListing,
  type OwnerProperty,
  type OwnerPropertyDetail,
} from "@/lib/auth-api";

function statusLabel(listing: OwnerListing): string {
  if (listing.admin_suspended_at) return "Tạm ẩn bởi quản trị viên";
  if (listing.archived_at) return "Đã lưu trữ";
  if (listing.publication_status === "PUBLISHED") return "Đang hiển thị";
  if (listing.publication_status === "HIDDEN") return "Đã ẩn";
  if (listing.moderation_status === "PENDING") return "Đang chờ duyệt";
  if (listing.moderation_status === "APPROVED") return "Đã duyệt · Chưa đăng";
  if (listing.moderation_status === "REJECTED") return "Cần chỉnh sửa";
  return "Bản nháp";
}

export default function OwnerListingsPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [listingByProperty, setListingByProperty] = useState<
    Record<string, OwnerListing | null>
  >({});
  const [propertyDetails, setPropertyDetails] = useState<
    Record<string, OwnerPropertyDetail>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<
    "all" | "action" | "published" | "draft"
  >("all");

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getOwnerProperties();
        if (ignore) return;
        setProperties(result);
        const rows = await Promise.all(
          result
            .filter((item) => !item.archived_at)
            .map(async (item) => {
              const [detail, listing] = await Promise.all([
                getOwnerProperty(item.id),
                getOwnerListing(item.id),
              ]);
              return { detail, listing };
            }),
        );
        if (ignore) return;
        setPropertyDetails(
          Object.fromEntries(rows.map((row) => [row.detail.id, row.detail])),
        );
        setListingByProperty(
          Object.fromEntries(rows.map((row) => [row.detail.id, row.listing])),
        );
      } catch (caught) {
        if (ignore) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError("Không thể tải danh sách bất động sản. Vui lòng thử lại.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [retry, router]);

  const activeProperties = useMemo(
    () => properties.filter((item) => !item.archived_at),
    [properties],
  );
  const rows = activeProperties.map((item) => ({
    property: item,
    detail: propertyDetails[item.id],
    listing: listingByProperty[item.id] ?? null,
  }));
  const filteredRows = rows.filter(
    ({ listing }) =>
      filter === "all" ||
      (filter === "published" && listing?.publication_status === "PUBLISHED") ||
      (filter === "draft" &&
        (!listing || listing.moderation_status === "DRAFT")) ||
      (filter === "action" &&
        (!listing ||
          listing.moderation_status === "REJECTED" ||
          listing.moderation_status === "PENDING" ||
          listing.admin_suspended_at !== null)),
  );
  const firstWithoutListing = rows.find(({ listing }) => !listing)?.property.id;

  return (
    <section className="mx-auto w-full max-w-5xl px-1 py-4 sm:px-2 sm:py-6">
      <header className="mb-6 sm:mb-8">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          CỔNG CHỦ NHÀ
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Tin đăng
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Soạn nội dung riêng cho tin đăng. Gửi duyệt và công khai là hai bước
          độc lập với việc quản lý bất động sản.
        </p>
      </header>
      {loading ? (
        <div className="animate-pulse space-y-4" aria-busy="true">
          <div className="h-24 rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <p className="text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => setRetry((current) => current + 1)}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Thử lại
          </button>
        </div>
      ) : activeProperties.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Cần có bất động sản trước
          </h2>
          <Link
            href="/owner/properties"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white"
          >
            Quản lý bất động sản
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-sm text-slate-600">
              Theo dõi xét duyệt và trạng thái hiển thị riêng với dữ liệu bất
              động sản.
            </p>
            {firstWithoutListing && (
              <Link
                href={`/owner/listings/new?propertyId=${firstWithoutListing}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white"
              >
                Tạo bài đăng
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="tablist">
            {(
              [
                ["all", `Tất cả · ${rows.length}`],
                ["action", "Cần xử lý"],
                ["published", "Đang đăng"],
                ["draft", "Bản nháp"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${filter === value ? "border-[#3368a0] bg-[#3368a0] text-white" : "border-slate-200 bg-white text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {filteredRows.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-4">Tiêu đề</th>
                      <th className="px-4 py-4">Bất động sản</th>
                      <th className="px-4 py-4">Trạng thái</th>
                      <th className="px-4 py-4">Căn đủ điều kiện hôm nay</th>
                      <th className="px-4 py-4">Cập nhật</th>
                      <th className="px-4 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map(({ property: item, detail, listing }) => {
                      const eligible =
                        detail?.units.filter(
                          (unit) =>
                            !unit.archived_at &&
                            unit.is_marketed &&
                            unit.operational_status === "READY",
                        ).length ?? 0;
                      const href = listing
                        ? `/owner/listings/${listing.id}`
                        : `/owner/listings/new?propertyId=${item.id}`;
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-4 font-semibold text-slate-900">
                            {listing?.title || "Chưa có bản nháp"}
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {item.name}
                          </td>
                          <td className="px-4 py-4">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {listing ? statusLabel(listing) : "Chưa có tin"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {eligible} /{" "}
                            {detail?.units.filter((unit) => !unit.archived_at)
                              .length ?? 0}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {new Date(item.updated_at).toLocaleDateString(
                              "vi-VN",
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <Link
                              href={href}
                              className="font-semibold text-[#3368a0] hover:underline"
                            >
                              {listing ? "Chỉnh sửa" : "Tạo bản nháp"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
              Không có tin đăng trong nhóm này.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
