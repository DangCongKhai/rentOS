"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  archiveOwnerListing,
  createOwnerListing,
  getOwnerListing,
  getOwnerProperties,
  getOwnerProperty,
  getOwnerPropertyMedia,
  hideOwnerListing,
  publishOwnerListing,
  submitOwnerListing,
  updateOwnerListing,
  type OwnerListing,
  type OwnerProperty,
  type OwnerPropertyDetail,
  type OwnerPropertyMedia,
  type OwnerUnit,
} from "@/lib/auth-api";

type FieldErrors = Record<string, string[]>;
type Action = "save" | "submit" | "publish" | "hide" | "archive" | null;

function unitIsCompleteForListing(unit: OwnerUnit): boolean {
  return unit.operational_status === "READY"
    && Boolean(unit.description?.trim())
    && unit.area_m2 !== null
    && unit.advertised_monthly_rent !== null
    && unit.deposit !== null
    && unit.max_occupants !== null;
}

const inputClass = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

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
  const [propertyId, setPropertyId] = useState("");
  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [listing, setListing] = useState<OwnerListing | null>(null);
  const [media, setMedia] = useState<OwnerPropertyMedia[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverId, setCoverId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<"all" | "action" | "published" | "draft">("all");
  const [listingByProperty, setListingByProperty] = useState<Record<string, OwnerListing | null>>({});
  const [propertyDetails, setPropertyDetails] = useState<Record<string, OwnerPropertyDetail>>({});
  const [editorView, setEditorView] = useState<"content" | "preview">("content");

  const activeProperties = useMemo(() => properties.filter((item) => !item.archived_at), [properties]);
  const sharedPhotos = useMemo(
    () => media.filter((item) => item.unit_id === null && item.is_selected_for_listing),
    [media],
  );

  const loadPropertyData = useCallback(async (id: string) => {
    if (!id) {
      setProperty(null);
      setListing(null);
      setMedia([]);
      setTitle("");
      setDescription("");
      setCoverId("");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    try {
      const [propertyResult, listingResult, mediaResult] = await Promise.all([
        getOwnerProperty(id),
        getOwnerListing(id),
        getOwnerPropertyMedia(id),
      ]);
      setProperty(propertyResult);
      setListing(listingResult);
      setMedia(mediaResult);
      setTitle(listingResult?.title ?? "");
      setDescription(listingResult?.description ?? "");
      setCoverId(listingResult?.cover_media_id ?? "");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Không thể tải dữ liệu tin đăng.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let ignore = false;

    async function loadProperties() {
      setLoading(true);
      setError(null);
      try {
        const result = await getOwnerProperties();
        if (ignore) return;
        setProperties(result);
        setPropertyId("");
        const rows = await Promise.all(result.filter((item) => !item.archived_at).map(async (item) => {
          const [detail, listing] = await Promise.all([getOwnerProperty(item.id), getOwnerListing(item.id)]);
          return { detail, listing };
        }));
        if (ignore) return;
        setPropertyDetails(Object.fromEntries(rows.map((row) => [row.detail.id, row.detail])));
        setListingByProperty(Object.fromEntries(rows.map((row) => [row.detail.id, row.listing])));
        setLoading(false);
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

    void loadProperties();
    return () => { ignore = true; };
  }, [loadPropertyData, router, retry]);

  function handlePropertyChange(id: string) {
    setPropertyId(id);
    setProperty(null);
    setListing(null);
    setEditing(true);
    void loadPropertyData(id);
  }

  function openEditor(id: string) {
    setEditing(true);
    setEditorView("content");
    handlePropertyChange(id);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    setSaving("save");
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      if (listing) {
        const updated = await updateOwnerListing(property.id, {
          expected_content_revision: property.content_revision,
          title,
          description,
          cover_media_id: coverId || null,
        });
        setListing(updated);
        setListingByProperty((rows) => ({ ...rows, [property.id]: updated }));
        setProperty((current) => current ? { ...current, content_revision: updated.property_content_revision } : current);
        setSuccess(updated.moderation_status === "DRAFT" && listing.moderation_status === "PENDING"
          ? "Đã lưu nội dung mới; hồ sơ chờ duyệt trước đó đã được mở lại thành bản nháp."
          : "Đã lưu tin đăng.");
      } else {
        const created = await createOwnerListing(property.id, {
          client_operation_id: crypto.randomUUID(),
          title,
          description,
          cover_media_id: coverId || null,
        });
        setListing(created);
        setListingByProperty((rows) => ({ ...rows, [property.id]: created }));
        setSuccess("Đã tạo bản nháp tin đăng. Bước duyệt và đăng tin được thực hiện riêng.");
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors);
        if (caught.status === 409) await loadPropertyData(property.id);
      } else {
        setError("Không thể lưu tin đăng. Vui lòng thử lại.");
      }
    } finally {
      setSaving(null);
    }
  }

  async function runAction(action: Exclude<Action, "save" | null>) {
    if (!property) return;
    if (action === "archive" && !window.confirm("Lưu trữ tin đăng này? Tin đăng sẽ không còn là tin hiện tại của bất động sản.")) return;
    setSaving(action);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      const revision = property.content_revision;
      const updated = action === "submit" ? await submitOwnerListing(property.id, revision)
        : action === "publish" ? await publishOwnerListing(property.id, revision)
          : action === "hide" ? await hideOwnerListing(property.id, revision)
            : await archiveOwnerListing(property.id, revision);
      if (action === "archive") {
        setListing(null);
        setListingByProperty((rows) => ({ ...rows, [property.id]: null }));
        setTitle("");
        setDescription("");
        setCoverId("");
        setSuccess("Tin đăng đã được lưu trữ. Bạn có thể tạo một tin đăng mới cho bất động sản này.");
      } else {
        setListing(updated);
        setListingByProperty((rows) => ({ ...rows, [property.id]: updated }));
        setSuccess(action === "submit" ? "Đã gửi hồ sơ để quản trị viên duyệt."
          : action === "publish" ? "Tin đăng đã được hiển thị."
            : "Tin đăng đã được ẩn.");
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors);
        if (caught.status === 409) await loadPropertyData(property.id);
      } else {
        setError("Không thể cập nhật trạng thái tin đăng. Vui lòng thử lại.");
      }
    } finally {
      setSaving(null);
    }
  }

  const canEdit = !listing || listing.moderation_status !== "PENDING";
  const currentStatus = listing ? statusLabel(listing) : "Chưa có tin đăng";
  const hasFieldErrors = Object.entries(fieldErrors);
  const marketedUnits = property?.units.filter((unit) => !unit.archived_at && unit.is_marketed) ?? [];
  const marketedUnitsComplete = marketedUnits.length > 0 && marketedUnits.every(unitIsCompleteForListing);
  const unitsReadyForListing = marketedUnitsComplete;
  const unitReadinessHint = marketedUnits.length === 0
    ? "Bật “Quảng cáo” cho ít nhất một căn trong Quản lý bất động sản → Danh sách căn."
    : !marketedUnitsComplete
      ? "Mỗi căn đang quảng cáo cần ở trạng thái Sẵn sàng và có mô tả, diện tích, giá thuê, tiền cọc, số người tối đa."
      : "Các căn đang quảng cáo đã đủ thông tin.";
  const coverPhoto = sharedPhotos.find((photo) => photo.id === coverId) ?? null;
  const rows = properties.filter((item) => !item.archived_at).map((item) => ({
    property: item,
    detail: propertyDetails[item.id],
    listing: listingByProperty[item.id] ?? null,
  }));
  const filteredRows = rows.filter(({ listing }) => filter === "all"
    || (filter === "published" && listing?.publication_status === "PUBLISHED")
    || (filter === "draft" && (!listing || listing.moderation_status === "DRAFT"))
    || (filter === "action" && (!listing || listing.moderation_status === "REJECTED" || listing.moderation_status === "PENDING" || listing.admin_suspended_at !== null)));

  return (
    <section className="mx-auto w-full max-w-5xl px-1 py-4 sm:px-2 sm:py-6">
      <header className="mb-6 sm:mb-8">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">CỔNG CHỦ NHÀ</span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Tin đăng</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Soạn nội dung riêng cho tin đăng. Gửi duyệt và công khai là hai bước độc lập với việc quản lý bất động sản.
        </p>
      </header>

      {loading && !property ? (
        <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Đang tải tin đăng">
          <div className="h-24 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-80 rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : error && !property ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" onClick={() => setRetry((current) => current + 1)} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Thử lại</button>
        </div>
      ) : activeProperties.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Cần có bất động sản trước</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Hãy tạo bất động sản, thêm phòng và ảnh trước. Tin đăng sẽ dùng lại thông tin và ảnh đã chọn của bất động sản đó.</p>
          <Link href="/owner/properties" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584]">Quản lý bất động sản</Link>
        </div>
      ) : !editing ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><p className="text-sm text-slate-600">Theo dõi xét duyệt và trạng thái hiển thị riêng với dữ liệu bất động sản.</p><button type="button" onClick={() => openEditor(rows.find(({ listing }) => !listing)?.property.id ?? rows[0].property.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584]">Tạo bài đăng</button></div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lọc tin đăng">{([ ["all", `Tất cả · ${rows.length}`], ["action", `Cần xử lý · ${rows.filter(({ listing }) => !listing || listing.moderation_status === "REJECTED" || listing.moderation_status === "PENDING" || listing.admin_suspended_at !== null).length}`], ["published", `Đang đăng · ${rows.filter(({ listing }) => listing?.publication_status === "PUBLISHED").length}`], ["draft", `Bản nháp · ${rows.filter(({ listing }) => !listing || listing.moderation_status === "DRAFT").length}`] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-sm font-medium ${filter === value ? "border-[#3368a0] bg-[#3368a0] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}</div>
          {filteredRows.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-4 py-4">Tiêu đề</th><th className="px-4 py-4">Bất động sản</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Căn đủ điều kiện hôm nay</th><th className="px-4 py-4">Cập nhật</th><th className="px-4 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map(({ property: item, detail, listing }) => { const eligible = detail?.units.filter((unit) => !unit.archived_at && unit.is_marketed && unit.operational_status === "READY").length ?? 0; return <tr key={item.id}><td className="px-4 py-4 font-semibold text-slate-900">{listing?.title || "Chưa có bản nháp"}{listing?.review_reason && <p className="mt-1 max-w-xs truncate text-xs font-normal text-rose-700">{listing.review_reason}</p>}</td><td className="px-4 py-4 text-slate-700">{item.name}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{listing ? statusLabel(listing) : "Chưa có tin"}</span>{listing?.admin_suspended_at && <p className="mt-2 text-xs text-rose-700">Tin đăng bị tạm ngưng bởi quản trị viên.</p>}</td><td className="px-4 py-4 text-slate-700">{eligible} / {detail?.units.filter((unit) => !unit.archived_at).length ?? 0}</td><td className="px-4 py-4 text-slate-600">{new Date(item.updated_at).toLocaleDateString("vi-VN")}</td><td className="px-4 py-4"><button type="button" onClick={() => openEditor(item.id)} className="font-semibold text-[#3368a0] hover:underline">{listing ? "Chỉnh sửa" : "Tạo bản nháp"}</button>{listing?.publication_status === "PUBLISHED" && <button type="button" onClick={() => openEditor(item.id)} className="ml-3 font-semibold text-slate-700 hover:underline">Ẩn</button>}</td></tr>; })}</tbody></table></div></div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">Không có tin đăng trong nhóm này.</div>}
          {!rows.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><p className="text-xs font-semibold text-slate-500">Trạng thái rỗng</p><h3 className="mt-2 font-semibold text-slate-900">Tạo tin đăng đầu tiên của bạn</h3><p className="mt-2 text-sm text-slate-600">Cần có một bất động sản với ít nhất một căn trước khi tạo bài đăng.</p><Link href="/owner/properties" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white">Thêm bất động sản</Link></div>}
        </div>
      ) : (
        <div className="space-y-5">
          <button type="button" onClick={() => { setEditing(false); setProperty(null); setListing(null); setError(null); setSuccess(null); }} className="text-sm font-semibold text-[#3368a0] hover:underline">← Danh sách tin đăng</button>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <label htmlFor="property-select" className="block text-sm font-semibold text-slate-800">Bất động sản</label>
            <select id="property-select" value={propertyId} onChange={(event) => handlePropertyChange(event.target.value)} className={inputClass}>
              {activeProperties.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.city || "Chưa có thành phố"}</option>)}
            </select>
            {property && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600"><span>{property.units.filter((unit) => !unit.archived_at).length} phòng</span><span aria-hidden="true">·</span><span>Phiên bản nội dung {property.content_revision}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">{currentStatus}</span></div>}
          </div>

          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
          {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
          {listing?.review_reason && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Phản hồi quản trị viên:</strong> {listing.review_reason}</div>}
          {listing?.admin_suspended_at && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Tin đăng đang bị quản trị viên tạm ngưng. Bạn không thể tự gỡ trạng thái này.</div>}

          {property && <nav aria-label="Chế độ chỉnh sửa tin đăng" className="flex gap-5 border-b border-slate-200"><button type="button" onClick={() => setEditorView("content")} className={`border-b-2 px-3 py-3 text-sm font-semibold ${editorView === "content" ? "border-[#3368a0] text-[#285584]" : "border-transparent text-slate-600"}`}>Nội dung</button><button type="button" onClick={() => setEditorView("preview")} className={`border-b-2 px-3 py-3 text-sm font-semibold ${editorView === "preview" ? "border-[#3368a0] text-[#285584]" : "border-transparent text-slate-600"}`}>Xem trước</button></nav>}
          {property && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          {editorView === "content" && <form id="listing-form" onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{listing ? "Nội dung tin đăng" : "Tạo bản nháp"}</h2>
                <p className="mt-1 text-sm text-slate-600">Bản nháp có thể chưa đầy đủ. Hệ thống sẽ kiểm tra toàn bộ gói trước khi gửi duyệt.</p>
              </div>
              {listing?.moderation_status === "PENDING" && <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">Đang chờ duyệt</span>}
            </div>

            {!canEdit && <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">Đang chờ duyệt. Nếu cần sửa, hãy lưu thay đổi để mở lại hồ sơ thành bản nháp.</p>}
            <div className="space-y-4">
              <div>
                <label htmlFor="listing-title" className="block text-sm font-semibold text-slate-800">Tiêu đề</label>
                <input id="listing-title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={5} maxLength={160} disabled={Boolean(listing?.archived_at)} className={inputClass} placeholder="Ví dụ: Căn hộ sáng thoáng gần trung tâm" />
                <p className="mt-1 text-xs text-slate-500">5–160 ký tự</p>
              </div>
              <div>
                <label htmlFor="listing-description" className="block text-sm font-semibold text-slate-800">Mô tả tin đăng</label>
                <textarea id="listing-description" value={description} onChange={(event) => setDescription(event.target.value)} required minLength={20} maxLength={10000} rows={6} disabled={Boolean(listing?.archived_at)} className={inputClass} placeholder="Mô tả trải nghiệm ở, vị trí và điểm nổi bật của nơi thuê." />
                <p className="mt-1 text-xs text-slate-500">20–10.000 ký tự</p>
              </div>
              <div>
                <label htmlFor="listing-cover" className="block text-sm font-semibold text-slate-800">Ảnh bìa</label>
                <select id="listing-cover" value={coverId} onChange={(event) => setCoverId(event.target.value)} disabled={Boolean(listing?.archived_at)} className={inputClass}>
                  <option value="">Chưa chọn ảnh bìa</option>
                  {sharedPhotos.map((photo) => <option key={photo.id} value={photo.id}>{photo.caption || `Ảnh dùng chung ${photo.sort_order + 1}`} · {photo.id.slice(0, 8)}</option>)}
                </select>
                {sharedPhotos.length === 0 && <p className="mt-1 text-xs text-amber-700">Chưa có ảnh dùng chung được chọn. Thêm ảnh và chọn ảnh cho tin đăng trong phần quản lý bất động sản.</p>}
                <p className="mt-1 text-xs text-slate-500">Ảnh bìa phải là ảnh dùng chung của bất động sản, đang hoạt động và được chọn trong thư viện ảnh.</p>
              </div>
            </div>

            {hasFieldErrors.length > 0 && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert"><p className="text-sm font-semibold text-rose-900">Cần hoàn tất các mục sau:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-800">{hasFieldErrors.map(([field, messages]) => <li key={field}>{messages[0]}</li>)}</ul></div>}

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap sm:items-center">
              {!listing?.archived_at && <button type="submit" disabled={saving !== null || loading} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-60">{saving === "save" ? "Đang lưu…" : listing ? "Lưu nội dung" : "Lưu bản nháp"}</button>}
              {listing && !listing.archived_at && <button type="button" onClick={() => void runAction("archive")} disabled={saving !== null || loading} className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">{saving === "archive" ? "Đang lưu trữ…" : "Lưu trữ"}</button>}
              {saving && <span className="text-sm text-slate-500" aria-live="polite">Đang cập nhật…</span>}
            </div>
          </form>}
          {editorView === "preview" && <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="relative flex aspect-[16/8] items-center justify-center overflow-hidden bg-[#d9e3ed] text-sm text-slate-500">{coverPhoto?.preview_url ? <Image src={coverPhoto.preview_url} alt={coverPhoto.caption || title || "Ảnh bìa tin đăng"} fill unoptimized sizes="(max-width: 1024px) 100vw, 66vw" className="object-cover" /> : <span>{coverPhoto?.caption || "Ảnh bìa tin đăng"}</span>}</div><div className="space-y-3 p-5"><p className="text-sm font-semibold text-[#3368a0]">{property.name}</p><h2 className="text-xl font-bold text-slate-900">{title || "Tiêu đề tin đăng"}</h2><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{description || "Mô tả sẽ xuất hiện tại đây."}</p><p className="text-xs text-slate-500">{property.address_line || "Chưa nhập địa chỉ"} · {property.city || "Chưa chọn thành phố"}</p></div></article>}

          <div className="space-y-4">
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:p-5">
              <h3 className="font-semibold text-slate-900">Trạng thái</h3>
              <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{listing?.moderation_status === "PENDING" ? "Chờ duyệt" : listing?.moderation_status === "APPROVED" ? "Đã duyệt" : listing?.moderation_status === "REJECTED" ? "Bị từ chối" : "Bản nháp"}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{listing?.publication_status === "PUBLISHED" ? "Đã đăng" : listing?.publication_status === "HIDDEN" ? "Đã ẩn" : "Bản nháp"}</span></div>
              <p className="mt-3 leading-6">{currentStatus}</p>
            </aside>
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 sm:p-5">
              <h3 className="font-semibold text-slate-900">Điều kiện gửi duyệt</h3>
              <ul className="mt-3 space-y-3">
                <li className="flex gap-2"><span className={property.address_line && property.city ? "text-emerald-700" : "text-rose-700"}>{property.address_line && property.city ? "✓" : "×"}</span>Địa chỉ đầy đủ</li>
                <li className="flex gap-2"><span className={sharedPhotos.length ? "text-emerald-700" : "text-rose-700"}>{sharedPhotos.length ? "✓" : "×"}</span>Có ít nhất một ảnh dùng chung</li>
                <li className="flex gap-2"><span className={unitsReadyForListing ? "text-emerald-700" : "text-rose-700"}>{unitsReadyForListing ? "✓" : "×"}</span><div><p>Căn được chọn quảng cáo đã đủ điều kiện đăng</p><p className={`mt-1 text-xs leading-5 ${unitsReadyForListing ? "text-slate-500" : "text-rose-700"}`}>{unitReadinessHint}</p></div></li>
                <li className="flex gap-2"><span className={Boolean(coverId) ? "text-emerald-700" : "text-rose-700"}>{coverId ? "✓" : "×"}</span>Đã chọn ảnh bìa</li>
              </ul>
              <Link href="/owner/properties" className="mt-4 inline-flex font-semibold text-[#3368a0] hover:underline">Quản lý bất động sản, căn và ảnh →</Link>
            </aside>
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-semibold text-slate-900">Gửi duyệt và đăng bài</h3><div className="mt-4 grid gap-2">{listing && ["DRAFT", "REJECTED"].includes(listing.moderation_status) && <button type="button" onClick={() => void runAction("submit")} disabled={saving !== null} className="min-h-11 rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white disabled:opacity-50">Gửi duyệt</button>}{listing?.moderation_status === "APPROVED" && listing.publication_status !== "PUBLISHED" && <button type="button" onClick={() => void runAction("publish")} disabled={saving !== null || Boolean(listing.admin_suspended_at)} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Đăng công khai</button>}{listing?.publication_status === "PUBLISHED" && <button type="button" onClick={() => void runAction("hide")} disabled={saving !== null} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">Ẩn tin đăng</button>}<button type="submit" form="listing-form" disabled={saving !== null || editorView !== "content" || Boolean(listing?.archived_at)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">Lưu nháp</button></div><p className="mt-3 text-xs leading-5 text-slate-500">Hoàn tất các điều kiện ở trên trước khi gửi duyệt.</p></aside>
            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:p-5"><h3 className="font-semibold text-slate-900">Bất động sản đang chọn</h3><p className="mt-1 leading-6">{property.name}. {property.address_line || "Chưa nhập địa chỉ"}, {property.city || "Chưa chọn thành phố"}. Có {property.units.filter((unit) => !unit.archived_at && unit.is_marketed).length} căn đang chọn để đăng.</p><Link href="/owner/properties" className="mt-2 inline-flex font-semibold text-[#3368a0] hover:underline">Quản lý dữ liệu bất động sản</Link></aside>
          </div>
          </div>}
        </div>
      )}
    </section>
  );
}
