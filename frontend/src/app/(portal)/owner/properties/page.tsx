"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getOwnerListing, getOwnerProperties, getOwnerProperty, type OwnerListing, type OwnerPropertyDetail } from "@/lib/auth-api";

const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584]";

function listingStatus(listing: OwnerListing | null) {
  if (!listing) return "Chưa có tin";
  if (listing.admin_suspended_at) return "Bị tạm ngưng";
  if (listing.publication_status === "PUBLISHED") return "Đang hiển thị";
  if (listing.moderation_status === "PENDING") return "Chờ duyệt";
  if (listing.moderation_status === "REJECTED") return "Cần chỉnh sửa";
  if (listing.moderation_status === "APPROVED") return "Đã duyệt";
  return "Bản nháp";
}

export default function OwnerPropertiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [summaries, setSummaries] = useState<Array<{ property: OwnerPropertyDetail; listing: OwnerListing | null }>>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await getOwnerProperties(true);
        if (!active) return;
        const rows = await Promise.all(items.map(async (item) => {
          const [detail, listing] = await Promise.all([getOwnerProperty(item.id), getOwnerListing(item.id)]);
          return { property: detail, listing };
        }));
        if (!active) return;
        setSummaries(rows);
      } catch (caught) {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "Không thể tải thông tin bất động sản.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry, router]);

  const listedProperties = summaries.filter(({ property }) => showArchived || !property.archived_at);

  return <section className="mx-auto w-full max-w-6xl px-1 py-4 sm:px-2 sm:py-6">
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Bất động sản</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Quản lý bất động sản, phòng và ảnh. Tin đăng được tạo riêng sau khi hoàn tất dữ liệu.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-4 accent-[#3368a0]" />Hiện mục đã lưu trữ</label>
        <Link href="/owner/properties/new" className={buttonClass}>Tạo bất động sản</Link>
      </div>
    </header>
    {loading && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" aria-busy="true">Đang tải bất động sản…</div>}
    {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}<button type="button" className="ml-3 font-semibold underline" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>}
    {!loading && listedProperties.length > 0 && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-4 py-4">Tên và địa chỉ</th><th className="px-4 py-4">Loại</th><th className="px-4 py-4">Hình thức cho thuê</th><th className="px-4 py-4">Số căn</th><th className="px-4 py-4">Tin đăng</th><th className="px-4 py-4">Cập nhật</th><th className="px-4 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{listedProperties.map(({ property: item, listing }) => <tr key={item.id} className="align-middle"><td className="px-4 py-4"><p className="font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{[item.address_line, item.ward, item.city].filter(Boolean).join(", ") || "Chưa nhập địa chỉ"}</p></td><td className="px-4 py-4 text-slate-700">{item.property_type}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{item.rental_arrangement === "WHOLE_SPACE" ? "Toàn bộ không gian" : "Từng căn riêng lẻ"}</span></td><td className="px-4 py-4 text-slate-700">{item.units.filter((unit) => !unit.archived_at).length}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${listing?.publication_status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{listingStatus(listing)}</span></td><td className="px-4 py-4 text-slate-600">{new Date(item.updated_at).toLocaleDateString("vi-VN")}</td><td className="px-4 py-4"><Link href={`/owner/properties/${item.id}`} className="font-semibold text-[#3368a0] hover:underline">Chỉnh sửa</Link></td></tr>)}</tbody></table></div></div>}
    {!loading && listedProperties.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái rỗng</p><h2 className="mt-2 text-lg font-semibold text-slate-900">Thêm bất động sản đầu tiên của bạn</h2><p className="mt-2 text-sm text-slate-600">Bắt đầu với thông tin cơ bản và địa chỉ, bạn có thể hoàn thiện sau.</p><Link href="/owner/properties/new" className={`${buttonClass} mt-5`}>Thêm bất động sản</Link></div>}
  </section>;
}
