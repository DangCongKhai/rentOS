"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { VietnamLocationPicker } from "@/components/vietnam-location-picker";
import {
  ApiError,
  archiveOwnerProperty,
  archiveOwnerUnit,
  createOwnerProperty,
  createOwnerUnit,
  createOwnerUnitBatch,
  getAmenityCatalog,
  getOwnerListing,
  getOwnerProperties,
  getOwnerProperty,
  getOwnerPropertyMedia,
  removeOwnerMedia,
  updateOwnerGallery,
  updateOwnerUnitGallery,
  updateOwnerProperty,
  updateOwnerUnit,
  uploadOwnerMedia,
  type AmenityCatalogEntry,
  type AmenityDocument,
  type OwnerPropertyDetail,
  type OwnerPropertyMedia,
  type OwnerListing,
  type OwnerUnit,
} from "@/lib/auth-api";

const fieldClass = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";

function fieldValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function listingUnitFieldErrors(unit: {
  description?: string | null;
  area_m2?: string | number | null;
  advertised_monthly_rent?: string | number | null;
  deposit?: string | number | null;
  max_occupants?: number | null;
  operational_status?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!unit.description?.trim()) errors.description = "Nhập mô tả phòng.";
  if (unit.area_m2 == null || Number(unit.area_m2) <= 0) errors.area_m2 = "Nhập diện tích lớn hơn 0.";
  if (unit.advertised_monthly_rent == null || Number(unit.advertised_monthly_rent) <= 0) errors.advertised_monthly_rent = "Nhập giá thuê tháng lớn hơn 0.";
  if (unit.deposit == null || Number(unit.deposit) < 0) errors.deposit = "Nhập tiền đặt cọc.";
  if (unit.max_occupants == null || unit.max_occupants < 1) errors.max_occupants = "Nhập số người tối đa.";
  return errors;
}

function numberValue(form: FormData, name: string): number | null {
  const value = fieldValue(form, name);
  return value === "" ? null : Number(value);
}

function AmenityFields({ catalog, scope, value }: { catalog: AmenityCatalogEntry[]; scope: "shared" | "unit"; value?: AmenityDocument }) {
  const entries = catalog.filter((item) => item.scopes.includes(scope));
  const selected = new Set(Object.entries(value?.standard ?? {}).filter(([, amenity]) => amenity.enabled).map(([key]) => key));

  return <fieldset className="space-y-2">
    <legend className="text-sm font-semibold text-slate-800">Tiện nghi {scope === "shared" ? "dùng chung" : "trong phòng"}</legend>
    <div className="flex flex-wrap gap-2">
      {entries.map((item) => <label key={item.key} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
        <input type="checkbox" name={`amenity:${item.key}`} defaultChecked={selected.has(item.key)} className="size-4 accent-[#3368a0]" />{item.label}
        <input type="text" name={`amenity_details:${item.key}`} defaultValue={value?.standard[item.key]?.details ?? ""} maxLength={160} aria-label={`Ghi chú ${item.label}`} placeholder="Ghi chú tùy chọn" className="ml-2 w-40 rounded-md border border-slate-200 px-2 py-1 text-xs" />
      </label>)}
    </div>
    <label className="block text-xs font-medium text-slate-600">Tiện nghi riêng, mỗi dòng một mục
      <textarea name="custom_amenities" defaultValue={value?.custom.join("\n") ?? ""} rows={2} className={fieldClass} placeholder="Ví dụ: Ban công hướng biển" />
    </label>
  </fieldset>;
}

function amenitiesFromForm(form: FormData, catalog: AmenityCatalogEntry[], scope: "shared" | "unit"): AmenityDocument {
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) => item.scopes.includes(scope))) {
    if (form.get(`amenity:${amenity.key}`) === "on") {
      const details = fieldValue(form, `amenity_details:${amenity.key}`);
      standard[amenity.key] = { enabled: true, ...(details ? { details } : {}) };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: fieldValue(form, "custom_amenities").split("\n").map((item) => item.trim()).filter(Boolean),
  };
}

function unitAmenityDefaultsFromForm(form: FormData, catalog: AmenityCatalogEntry[], index: number): AmenityDocument {
  const prefix = `bulk_${index}_`;
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) => item.scopes.includes("unit"))) {
    if (form.get(`${prefix}amenity:${amenity.key}`) === "on") {
      const details = fieldValue(form, `${prefix}details:${amenity.key}`);
      standard[amenity.key] = { enabled: true, ...(details ? { details } : {}) };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: fieldValue(form, `${prefix}custom_amenities`).split("\n").map((item) => item.trim()).filter(Boolean),
  };
}

export default function OwnerPropertiesPage() {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState("");
  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [media, setMedia] = useState<OwnerPropertyMedia[]>([]);
  const [catalog, setCatalog] = useState<AmenityCatalogEntry[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OwnerUnit | null>(null);
  const [bulkLabels, setBulkLabels] = useState("");
  const [galleryItems, setGalleryItems] = useState<OwnerPropertyMedia[]>([]);
  const [unitGalleryItems, setUnitGalleryItems] = useState<Record<string, OwnerPropertyMedia[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState<"overview" | "units" | "photos">("overview");
  const [showArchived, setShowArchived] = useState(false);
  const [summaries, setSummaries] = useState<Array<{ property: OwnerPropertyDetail; listing: OwnerListing | null }>>([]);
  const [pendingPhotos, setPendingPhotos] = useState<Array<{ file: File; operationId: string }>>([]);
  const [uploadedPhotoCount, setUploadedPhotoCount] = useState(0);

  const sharedMedia = useMemo(() => media.filter((item) => item.unit_id === null), [media]);

  const loadProperty = useCallback(async (id: string) => {
    if (!id) {
      setProperty(null);
      setMedia([]);
      return;
    }
    const [detail, photos] = await Promise.all([getOwnerProperty(id), getOwnerPropertyMedia(id)]);
    setProperty(detail);
    setMedia(photos);
    setGalleryItems(photos.filter((item) => item.unit_id === null).sort((a, b) => a.sort_order - b.sort_order));
    setUnitGalleryItems(Object.fromEntries(
      photos.filter((item) => item.unit_id !== null)
        .reduce((groups, item) => groups.set(item.unit_id!, [...(groups.get(item.unit_id!) ?? []), item]), new Map<string, OwnerPropertyMedia[]>())
        .entries(),
    ));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [items, amenities] = await Promise.all([getOwnerProperties(true), getAmenityCatalog()]);
        if (!active) return;
        setCatalog(amenities);
        setPropertyId("");
        const rows = await Promise.all(items.map(async (item) => {
          const [detail, listing] = await Promise.all([
            getOwnerProperty(item.id),
            getOwnerListing(item.id),
          ]);
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
  }, [loadProperty, retry, router]);

  async function reloadProperty(id = propertyId) {
    await loadProperty(id);
    const [detail, listing] = await Promise.all([getOwnerProperty(id), getOwnerListing(id)]);
    setSummaries((rows) => rows.some((row) => row.property.id === id)
      ? rows.map((row) => row.property.id === id ? { property: detail, listing } : row)
      : [...rows, { property: detail, listing }]);
  }

  function reportError(caught: unknown) {
    if (caught instanceof ApiError) {
      setError(caught.message);
      setFieldErrors(caught.errors);
      if (caught.status === 401) router.replace("/login");
    } else {
      setError("Không thể lưu thay đổi. Vui lòng thử lại.");
    }
  }

  async function saveProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    const payload = {
      name: fieldValue(form, "name"),
      property_type: fieldValue(form, "property_type"),
      rental_arrangement: creating ? fieldValue(form, "rental_arrangement") : property?.rental_arrangement,
      address_line: fieldValue(form, "address_line") || null,
      ward: fieldValue(form, "ward") || null,
      city: fieldValue(form, "city") || null,
      description: fieldValue(form, "description") || null,
      shared_amenities: amenitiesFromForm(form, catalog, "shared"),
      policies: {
        schema_version: 1,
        pets: fieldValue(form, "pets"),
        smoking: fieldValue(form, "smoking"),
        shared_rules: fieldValue(form, "shared_rules").split("\n").map((item) => item.trim()).filter(Boolean),
      },
    };
    try {
      if (creating) {
        const created = await createOwnerProperty({ client_operation_id: crypto.randomUUID(), ...payload });
        setPropertyId(created.id);
        setCreating(false);
        await reloadProperty(created.id);
        setNotice("Bất động sản đã được tạo thành công.");
      } else if (property) {
        const updated = await updateOwnerProperty(property.id, { ...payload, expected_content_revision: property.content_revision });
        setProperty(updated);
        await reloadProperty(property.id);
        setNotice("Thông tin bất động sản đã được lưu.");
      }
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function archiveProperty() {
    if (!property || !window.confirm("Lưu trữ bất động sản này? Lịch sử phòng và tin đăng vẫn được giữ.")) return;
    setBusy(true);
    try {
      await archiveOwnerProperty(property.id, property.content_revision);
      setProperty(null);
      setPropertyId("");
      setSummaries((rows) => rows.map((row) => row.property.id === property.id
        ? { ...row, property: { ...row.property, archived_at: new Date().toISOString() } }
        : row));
      setNotice("Bất động sản đã được lưu trữ.");
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});
    const payload = {
      label: fieldValue(form, "label"),
      unit_kind: fieldValue(form, "unit_kind"),
      description: fieldValue(form, "description") || null,
      floor: fieldValue(form, "floor") || null,
      area_m2: numberValue(form, "area_m2"),
      bedrooms: numberValue(form, "bedrooms") ?? 0,
      bathrooms: numberValue(form, "bathrooms") ?? 0,
      bathroom_arrangement: fieldValue(form, "bathroom_arrangement"),
      advertised_monthly_rent: numberValue(form, "advertised_monthly_rent"),
      deposit: numberValue(form, "deposit"),
      minimum_rental_months: numberValue(form, "minimum_rental_months") ?? 3,
      max_occupants: numberValue(form, "max_occupants"),
      operational_status: fieldValue(form, "operational_status") || "READY",
      is_marketed: form.get("is_marketed") === "on",
      amenities: amenitiesFromForm(form, catalog, "unit"),
      policy_overrides: {
        ...(fieldValue(form, "pets_override") ? { pets: fieldValue(form, "pets_override") } : {}),
        ...(fieldValue(form, "smoking_override") ? { smoking: fieldValue(form, "smoking_override") } : {}),
        additional_rules: fieldValue(form, "additional_rules").split("\n").map((item) => item.trim()).filter(Boolean),
      },
    };
    if (payload.is_marketed) {
      const listingErrors = listingUnitFieldErrors(payload);
      if (Object.keys(listingErrors).length > 0) {
        setError("Hoàn thiện thông tin bắt buộc trước khi chọn căn này để đăng tin.");
        setFieldErrors(Object.fromEntries(Object.entries(listingErrors).map(([field, message]) => [field, [message]])));
        return;
      }
    }
    setBusy(true);
    try {
      if (editingUnit) {
        await updateOwnerUnit(property.id, editingUnit.id, { ...payload, expected_content_revision: property.content_revision });
        setNotice("Thông tin phòng đã được cập nhật.");
        setEditingUnit(null);
      } else {
        await createOwnerUnit(property.id, { ...payload, client_operation_id: crypto.randomUUID() });
        setNotice("Phòng đã được thêm.");
      }
      await reloadProperty();
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function toggleUnitMarketing(unit: OwnerUnit) {
    if (!property) return;
    if (!unit.is_marketed) {
      const listingErrors = listingUnitFieldErrors(unit);
      if (Object.keys(listingErrors).length > 0) {
        setEditingUnit(unit);
        setError("Hoàn thiện các thông tin dưới đây rồi lưu căn để bật quảng cáo.");
        setFieldErrors(Object.fromEntries(Object.entries(listingErrors).map(([field, message]) => [field, [message]])));
        return;
      }
    }

    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await updateOwnerUnit(property.id, unit.id, {
        expected_content_revision: property.content_revision,
        is_marketed: !unit.is_marketed,
      });
      await reloadProperty();
      setNotice(unit.is_marketed ? "Đã tắt quảng cáo cho căn này." : "Đã bật quảng cáo cho căn này.");
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function addUnitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    const form = new FormData(event.currentTarget);
    const labels = bulkPreviewLabels;
    if (labels.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createOwnerUnitBatch(property.id, {
        expected_content_revision: property.content_revision,
        client_operation_id: crypto.randomUUID(),
        units: labels.map((label, index) => ({
          client_operation_id: crypto.randomUUID(),
          label: fieldValue(form, `bulk_${index}_label`) || label,
          unit_kind: fieldValue(form, `bulk_${index}_unit_kind`) || "ROOM",
          description: fieldValue(form, `bulk_${index}_description`) || null,
          area_m2: numberValue(form, `bulk_${index}_area_m2`),
          bedrooms: numberValue(form, `bulk_${index}_bedrooms`) ?? 0,
          bathrooms: numberValue(form, `bulk_${index}_bathrooms`) ?? 1,
          bathroom_arrangement: fieldValue(form, `bulk_${index}_bathroom_arrangement`) || "PRIVATE",
          minimum_rental_months: numberValue(form, `bulk_${index}_minimum_rental_months`) ?? 3,
          advertised_monthly_rent: numberValue(form, `bulk_${index}_rent`),
          deposit: numberValue(form, `bulk_${index}_deposit`),
          max_occupants: numberValue(form, `bulk_${index}_max_occupants`),
          amenities: unitAmenityDefaultsFromForm(form, catalog, index),
          policy_overrides: {
            additional_rules: fieldValue(form, `bulk_${index}_additional_rules`).split("\n").map((rule) => rule.trim()).filter(Boolean),
          },
        })),
      });
      setBulkLabels("");
      setNotice(`Đã thêm ${labels.length} phòng.`);
      await reloadProperty();
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function archiveUnit(unit: OwnerUnit) {
    if (!property || !window.confirm(`Lưu trữ ${unit.label}?`)) return;
    setBusy(true);
    try {
      await archiveOwnerUnit(property.id, unit.id, property.content_revision);
      await reloadProperty();
      setNotice("Phòng đã được lưu trữ.");
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    const files = pendingPhotos.map((photo) => photo.file);
    if (files.length === 0) return;
    if (files.some((file) => !/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) || file.size > 8 * 1024 * 1024)) {
      setError("Chỉ hỗ trợ JPG, PNG hoặc WEBP tối đa 8 MB mỗi ảnh.");
      return;
    }
    if (media.length + files.length - uploadedPhotoCount > 20) {
      setError("Mỗi bất động sản có thể lưu tối đa 20 ảnh.");
      return;
    }
    setBusy(true);
    setNotice(`Đang tải ${files.length - uploadedPhotoCount} ảnh lên…`);
    setError(null);
    try {
      let currentProperty = property;
      for (let index = uploadedPhotoCount; index < pendingPhotos.length; index++) {
        const photo = pendingPhotos[index];
        await uploadOwnerMedia(currentProperty.id, {
          file: photo.file,
          client_operation_id: photo.operationId,
          expected_content_revision: currentProperty.content_revision,
          unit_id: fieldValue(form, "unit_id") || undefined,
          caption: fieldValue(form, "caption") || undefined,
        });
        setUploadedPhotoCount(index + 1);
        currentProperty = await getOwnerProperty(currentProperty.id);
        setProperty(currentProperty);
      }
      formElement.reset();
      setPendingPhotos([]);
      setUploadedPhotoCount(0);
      await loadProperty(property.id);
      setNotice("Ảnh đã được tải lên.");
    } catch (caught) {
      setNotice(null);
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function saveGalleryItems(items: OwnerPropertyMedia[]): Promise<boolean> {
    if (!property) return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateOwnerGallery(property.id, {
        expected_content_revision: property.content_revision,
        items: items.map((item, index) => ({
          media_id: item.id,
          revision: item.revision,
          sort_order: index,
          is_selected_for_listing: item.is_selected_for_listing,
        })),
      });
      await reloadProperty();
      setNotice("Thứ tự ảnh và lựa chọn hiển thị đã được lưu.");
      return true;
    } catch (caught) {
      reportError(caught);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function moveGalleryItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (busy || targetIndex < 0 || targetIndex >= galleryItems.length) return;
    const previousItems = galleryItems;
    const reordered = [...galleryItems];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setGalleryItems(reordered);
    if (!await saveGalleryItems(reordered)) setGalleryItems(previousItems);
  }

  async function saveGallery() {
    await saveGalleryItems(galleryItems);
  }

  async function saveUnitGalleryItems(unitId: string, items: OwnerPropertyMedia[]): Promise<boolean> {
    if (!property) return false;
    setBusy(true);
    setError(null);
    try {
      await updateOwnerUnitGallery(property.id, unitId, {
        expected_content_revision: property.content_revision,
        items: items.map((item, index) => ({
          media_id: item.id,
          revision: item.revision,
          sort_order: index,
          is_selected_for_listing: item.is_selected_for_listing,
        })),
      });
      await reloadProperty();
      setNotice("Thứ tự và lựa chọn ảnh phòng đã được lưu.");
      return true;
    } catch (caught) {
      reportError(caught);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function moveUnitGalleryItem(unitId: string, index: number, direction: -1 | 1) {
    const current = unitGalleryItems[unitId] ?? [];
    const targetIndex = index + direction;
    if (busy || targetIndex < 0 || targetIndex >= current.length) return;
    const reordered = [...current];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setUnitGalleryItems((items) => ({ ...items, [unitId]: reordered }));
    if (!await saveUnitGalleryItems(unitId, reordered)) {
      setUnitGalleryItems((items) => ({ ...items, [unitId]: current }));
    }
  }

  async function saveUnitGallery(unitId: string) {
    await saveUnitGalleryItems(unitId, unitGalleryItems[unitId] ?? []);
  }

  async function removePhoto(photo: OwnerPropertyMedia) {
    if (!property || !window.confirm("Gỡ ảnh khỏi thư viện? Tệp được lưu giữ trong lịch sử.")) return;
    setBusy(true);
    setError(null);
    try {
      await removeOwnerMedia(property.id, photo.id, property.content_revision, photo.revision);
      await reloadProperty();
      setNotice("Ảnh đã được gỡ khỏi thư viện.");
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  const policy = property?.policies;
  const units = property?.units.filter((unit) => !unit.archived_at) ?? [];
  const bulkPreviewLabels = bulkLabels.split("\n").map((label) => label.trim()).filter(Boolean);
  const listedProperties = summaries.filter(({ property: item }) => showArchived || !item.archived_at);
  const listingStatus = (listing: OwnerListing | null) => {
    if (!listing) return "Chưa có tin";
    if (listing.admin_suspended_at) return "Bị tạm ngưng";
    if (listing.publication_status === "PUBLISHED") return "Đang hiển thị";
    if (listing.moderation_status === "PENDING") return "Chờ duyệt";
    if (listing.moderation_status === "REJECTED") return "Cần chỉnh sửa";
    if (listing.moderation_status === "APPROVED") return "Đã duyệt";
    return "Bản nháp";
  };

  return <section className="mx-auto w-full max-w-6xl px-1 py-4 sm:px-2 sm:py-6">
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>{property && !creating && <button type="button" onClick={() => { setProperty(null); setPropertyId(""); setWorkspaceTab("overview"); setNotice(null); }} className="mb-2 text-sm font-semibold text-[#3368a0] hover:underline">← Danh sách bất động sản</button>}<h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{creating ? "Tạo bất động sản" : property ? property.name : "Bất động sản"}</h1>{!property && !creating && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Quản lý bất động sản, phòng và ảnh. Tin đăng được tạo riêng sau khi hoàn tất dữ liệu.</p>}</div>
      {!property && !creating && <div className="flex flex-wrap items-center gap-4"><label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-4 accent-[#3368a0]" />Hiện mục đã lưu trữ</label><button type="button" onClick={() => router.push("/owner/properties/new")} className={buttonClass}>Tạo bất động sản</button></div>}
    </header>

    {loading && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" aria-busy="true">Đang tải bất động sản…</div>}
    {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}<button type="button" className="ml-3 font-semibold underline" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {Object.entries(fieldErrors).length > 0 && <ul role="alert" className="mb-4 list-disc rounded-xl border border-rose-200 bg-rose-50 px-8 py-3 text-sm text-rose-800">{Object.entries(fieldErrors).map(([field, messages]) => <li key={field}>{messages[0]}</li>)}</ul>}

    {!creating && !property && !loading && listedProperties.length > 0 && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-4 py-4">Tên và địa chỉ</th><th className="px-4 py-4">Loại</th><th className="px-4 py-4">Hình thức cho thuê</th><th className="px-4 py-4">Số căn</th><th className="px-4 py-4">Tin đăng</th><th className="px-4 py-4">Cập nhật</th><th className="px-4 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{listedProperties.map(({ property: item, listing }) => <tr key={item.id} className="align-middle"><td className="px-4 py-4"><p className="font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{[item.address_line, item.ward, item.city].filter(Boolean).join(", ") || "Chưa nhập địa chỉ"}</p></td><td className="px-4 py-4 text-slate-700">{item.property_type}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{item.rental_arrangement === "WHOLE_SPACE" ? "Toàn bộ không gian" : "Từng căn riêng lẻ"}</span></td><td className="px-4 py-4 text-slate-700">{item.units.filter((unit) => !unit.archived_at).length}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${listing?.publication_status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{listingStatus(listing)}</span></td><td className="px-4 py-4 text-slate-600">{new Date(item.updated_at).toLocaleDateString("vi-VN")}</td><td className="px-4 py-4"><button type="button" className="font-semibold text-[#3368a0] hover:underline" onClick={async () => { setPropertyId(item.id); setWorkspaceTab("overview"); setLoading(true); try { await loadProperty(item.id); } catch (caught) { reportError(caught); } finally { setLoading(false); } }}>Chỉnh sửa</button>{!item.archived_at && <button type="button" onClick={async () => { setPropertyId(item.id); setWorkspaceTab("units"); setLoading(true); try { await loadProperty(item.id); } catch (caught) { reportError(caught); } finally { setLoading(false); } }} className="ml-4 font-semibold text-slate-700 hover:underline">Phòng</button>}</td></tr>)}</tbody></table></div></div>}

    {!creating && !property && !loading && listedProperties.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái rỗng</p><h2 className="mt-2 text-lg font-semibold text-slate-900">Thêm bất động sản đầu tiên của bạn</h2><p className="mt-2 text-sm text-slate-600">Bắt đầu với thông tin cơ bản và địa chỉ, bạn có thể hoàn thiện sau.</p><button type="button" onClick={() => router.push("/owner/properties/new")} className={`${buttonClass} mt-5`}>Thêm bất động sản</button></div>}

    {property && <nav aria-label="Quản lý bất động sản" className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">{([ ["overview", "Thông tin"], ["units", "Danh sách căn"], ["photos", "Hình ảnh"] ] as const).map(([tab, label]) => <button key={tab} type="button" onClick={() => { setWorkspaceTab(tab); setEditingUnit(null); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${workspaceTab === tab ? "bg-[#3368a0] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}</nav>}

    {(creating || property) && <div className="space-y-5">
      {workspaceTab === "overview" && <>
      <form key={creating ? "new-property" : property?.id} onSubmit={saveProperty} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{creating ? "Tạo bất động sản" : "Thông tin bất động sản"}</h2>{property && <p className="mt-1 text-xs text-slate-500">Phiên bản nội dung {property.content_revision}</p>}</div>{property && <button type="button" onClick={() => void archiveProperty()} disabled={busy} className="text-sm font-semibold text-rose-700 hover:underline">Lưu trữ</button>}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Tên bất động sản<input name="name" required maxLength={255} defaultValue={property?.name ?? ""} className={fieldClass} /></label>
          <label className="text-sm font-medium text-slate-700">Loại bất động sản<select name="property_type" defaultValue={property?.property_type ?? "APARTMENT"} className={fieldClass}><option value="APARTMENT">Căn hộ</option><option value="APARTMENT_BUILDING">Tòa căn hộ</option><option value="HOUSE">Nhà</option></select></label>
          <label className="text-sm font-medium text-slate-700">Cách cho thuê<select name="rental_arrangement" defaultValue={property?.rental_arrangement ?? "WHOLE_SPACE"} disabled={!creating} className={fieldClass}><option value="WHOLE_SPACE">Cho thuê nguyên căn / nguyên căn hộ</option><option value="SEPARATE_UNITS">Cho thuê từng phòng</option></select>{property && <span className="mt-1 block text-xs text-slate-500">Cách cho thuê đã cố định khi tạo bất động sản.</span>}</label>
          <label className="text-sm font-medium text-slate-700">Địa chỉ<input name="address_line" maxLength={500} defaultValue={property?.address_line ?? ""} className={fieldClass} placeholder="Số nhà, đường, khu vực" /></label>
          <div className="md:col-span-2"><VietnamLocationPicker initialCity={property?.city ?? ""} initialWard={property?.ward ?? ""} required={false} /></div>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Mô tả bất động sản<textarea name="description" rows={4} maxLength={10000} defaultValue={property?.description ?? ""} className={fieldClass} /></label>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AmenityFields key={`shared-${property?.id ?? "new"}`} catalog={catalog} scope="shared" value={property?.shared_amenities} />
          <fieldset className="space-y-3"><legend className="text-sm font-semibold text-slate-800">Quy định dùng chung</legend>
            <label className="block text-xs font-medium text-slate-600">Thú cưng<select name="pets" defaultValue={policy?.pets ?? "NOT_ALLOWED"} className={fieldClass}><option value="NOT_ALLOWED">Không cho phép</option><option value="WITH_APPROVAL">Cần phê duyệt</option><option value="ALLOWED">Được phép</option></select></label>
            <label className="block text-xs font-medium text-slate-600">Hút thuốc<select name="smoking" defaultValue={policy?.smoking ?? "NOT_ALLOWED"} className={fieldClass}><option value="NOT_ALLOWED">Không cho phép</option><option value="OUTDOOR_ONLY">Chỉ khu vực ngoài trời</option><option value="ALLOWED">Được phép</option></select></label>
            <label className="block text-xs font-medium text-slate-600">Quy định khác, mỗi dòng một mục<textarea name="shared_rules" rows={3} defaultValue={policy?.shared_rules.join("\n") ?? ""} className={fieldClass} placeholder="Ví dụ: Giữ yên tĩnh sau 22:00" /></label>
          </fieldset>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5"><button type="submit" disabled={busy} className={buttonClass}>{busy ? "Đang lưu…" : creating ? "Tạo bất động sản" : "Lưu thông tin"}</button>{creating && <button type="button" onClick={() => setCreating(false)} className={secondaryButtonClass}>Hủy</button>}</div>
      </form>

      </>}
      {!creating && property && workspaceTab === "units" && <div className="space-y-5">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><h2 className="text-lg font-semibold text-slate-900">Danh sách căn</h2><p className="mt-1 text-sm text-slate-600">Trạng thái vận hành độc lập với việc chọn căn đăng tin.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{units.length} căn</span></div>
            {units.length === 0 ? <p className="m-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Chưa có căn. Thêm căn hoặc dùng công cụ tạo hàng loạt.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-4 py-3">Căn</th><th className="px-4 py-3">Loại · diện tích</th><th className="px-4 py-3">Giá thuê</th><th className="px-4 py-3">Tiền cọc</th><th className="px-4 py-3">Vận hành</th><th className="px-4 py-3">Quảng cáo</th><th className="px-4 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{units.map((unit) => <tr key={unit.id}><td className="px-4 py-3 font-semibold text-[#3368a0]">{unit.label}</td><td className="px-4 py-3 text-slate-700">{unit.unit_kind}{unit.area_m2 ? ` · ${unit.area_m2} m²` : ""}</td><td className="px-4 py-3 text-slate-700">{unit.advertised_monthly_rent ? `${Number(unit.advertised_monthly_rent).toLocaleString("vi-VN")} ₫` : "—"}</td><td className="px-4 py-3 text-slate-700">{unit.deposit ? `${Number(unit.deposit).toLocaleString("vi-VN")} ₫` : "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${unit.operational_status === "READY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{unit.operational_status === "READY" ? "Sẵn sàng" : unit.operational_status === "MAINTENANCE" ? "Bảo trì" : "Ngừng"}</span></td><td className="px-4 py-3"><button type="button" role="switch" aria-checked={unit.is_marketed} onClick={() => void toggleUnitMarketing(unit)} disabled={busy} className={`h-6 w-11 rounded-full p-1 transition ${unit.is_marketed ? "bg-[#3368a0]" : "bg-slate-300"}`}><span className={`block size-4 rounded-full bg-white transition ${unit.is_marketed ? "translate-x-5" : "translate-x-0"}`} /></button></td><td className="px-4 py-3"><button type="button" onClick={() => setEditingUnit(unit)} className="font-semibold text-[#3368a0] hover:underline">Sửa</button>{property.rental_arrangement === "SEPARATE_UNITS" && <button type="button" onClick={() => void archiveUnit(unit)} disabled={busy} className="ml-3 font-semibold text-rose-700 hover:underline">Lưu trữ</button>}</td></tr>)}</tbody></table></div>}
          </section>

          {(property.rental_arrangement === "SEPARATE_UNITS" || editingUnit !== null) && <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-900">{editingUnit ? `Sửa ${editingUnit.label}` : "Thêm phòng"}</h2><form key={editingUnit?.id ?? "new-unit"} onSubmit={saveUnit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Tên phòng<input name="label" required maxLength={120} defaultValue={editingUnit?.label ?? ""} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Loại phòng<select name="unit_kind" defaultValue={editingUnit?.unit_kind ?? "ROOM"} className={fieldClass}><option value="ROOM">Phòng</option><option value="STUDIO">Studio</option><option value="APARTMENT">Căn hộ</option><option value="HOUSE">Nhà</option></select></label>
            <label className="text-sm font-medium text-slate-700">Diện tích (m²)<input name="area_m2" type="number" min="0.1" step="0.01" defaultValue={editingUnit?.area_m2 ?? ""} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Tầng<input name="floor" defaultValue={editingUnit?.floor ?? ""} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Phòng ngủ<input name="bedrooms" type="number" min="0" required defaultValue={editingUnit?.bedrooms ?? 0} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Phòng tắm<input name="bathrooms" type="number" min="0" step="0.5" required defaultValue={editingUnit?.bathrooms ?? 1} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Phòng tắm<select name="bathroom_arrangement" defaultValue={editingUnit?.bathroom_arrangement ?? "PRIVATE"} className={fieldClass}><option value="PRIVATE">Riêng</option><option value="SHARED">Dùng chung</option></select></label>
            <label className="text-sm font-medium text-slate-700">Thời hạn thuê tối thiểu (tháng)<input name="minimum_rental_months" type="number" min="3" required defaultValue={editingUnit?.minimum_rental_months ?? 3} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Giá thuê tháng (VND)<input name="advertised_monthly_rent" type="number" min="1" defaultValue={editingUnit?.advertised_monthly_rent ?? ""} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Tiền đặt cọc (VND)<input name="deposit" type="number" min="0" defaultValue={editingUnit?.deposit ?? ""} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Số người tối đa<input name="max_occupants" type="number" min="1" defaultValue={editingUnit?.max_occupants ?? ""} className={fieldClass} /></label>
            {editingUnit && <label className="text-sm font-medium text-slate-700">Trạng thái<select name="operational_status" defaultValue={editingUnit.operational_status} className={fieldClass}><option value="READY">Sẵn sàng</option><option value="MAINTENANCE">Bảo trì</option><option value="RETIRED">Ngừng khai thác</option></select></label>}
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Mô tả phòng<textarea name="description" rows={3} defaultValue={editingUnit?.description ?? ""} className={fieldClass} /></label>
            <label className="inline-flex items-start gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" name="is_marketed" defaultChecked={editingUnit?.is_marketed ?? false} className="mt-1 size-4 accent-[#3368a0]" /><span>Chọn phòng này để đăng tin <span className="block text-xs text-slate-500">Cần mô tả, diện tích, giá thuê, tiền cọc, số người và ảnh phòng.</span></span></label>
            <div className="sm:col-span-2"><AmenityFields key={`unit-${editingUnit?.id ?? "new"}`} catalog={catalog} scope="unit" value={editingUnit?.amenities} /></div>
            <label className="text-sm font-medium text-slate-700">Thú cưng<select name="pets_override" defaultValue={editingUnit?.policy_overrides.pets ?? ""} className={fieldClass}><option value="">Theo quy định chung</option><option value="NOT_ALLOWED">Không cho phép</option><option value="WITH_APPROVAL">Cần phê duyệt</option><option value="ALLOWED">Được phép</option></select></label>
            <label className="text-sm font-medium text-slate-700">Hút thuốc<select name="smoking_override" defaultValue={editingUnit?.policy_overrides.smoking ?? ""} className={fieldClass}><option value="">Theo quy định chung</option><option value="NOT_ALLOWED">Không cho phép</option><option value="OUTDOOR_ONLY">Chỉ ngoài trời</option><option value="ALLOWED">Được phép</option></select></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Quy định riêng, mỗi dòng một mục<textarea name="additional_rules" rows={2} defaultValue={editingUnit?.policy_overrides.additional_rules?.join("\n") ?? ""} className={fieldClass} /></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={busy} className={buttonClass}>{busy ? "Đang lưu…" : editingUnit ? "Lưu phòng" : "Thêm phòng"}</button>{editingUnit && <button type="button" onClick={() => setEditingUnit(null)} className={secondaryButtonClass}>Hủy sửa</button>}</div>
          </form></section>

          {property.rental_arrangement === "SEPARATE_UNITS" && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-900">Thêm nhiều phòng</h2><p className="mt-1 text-sm text-slate-600">Tạo danh sách xem trước rồi chỉnh từng căn trước khi lưu. Lô sẽ được lưu nguyên tử.</p><form onSubmit={addUnitBatch} className="mt-4 space-y-4"><label className="block text-sm font-medium text-slate-700">Tên phòng, mỗi tên một dòng<textarea value={bulkLabels} onChange={(event) => setBulkLabels(event.target.value)} rows={3} className={fieldClass} placeholder={'Phòng 101\nPhòng 102\nPhòng 103'} /></label>{bulkPreviewLabels.length > 0 && <div className="space-y-4">{bulkPreviewLabels.map((label, index) => <fieldset key={`${index}-${label}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold text-slate-800">Căn xem trước {index + 1}</legend><label className="text-xs font-medium text-slate-600 sm:col-span-2">Tên căn<input name={`bulk_${index}_label`} defaultValue={label} className={fieldClass} /></label><label className="text-xs font-medium text-slate-600">Loại căn<select name={`bulk_${index}_unit_kind`} className={fieldClass}><option value="ROOM">Phòng</option><option value="STUDIO">Studio</option><option value="APARTMENT">Căn hộ</option><option value="HOUSE">Nhà</option></select></label><label className="text-xs font-medium text-slate-600">Diện tích (m²)<input name={`bulk_${index}_area_m2`} type="number" min="0.1" step="0.1" className={fieldClass} /></label><label className="text-xs font-medium text-slate-600">Phòng ngủ<input name={`bulk_${index}_bedrooms`} type="number" min="0" defaultValue={1} className={fieldClass} /></label><label className="text-xs font-medium text-slate-600">Phòng tắm<input name={`bulk_${index}_bathrooms`} type="number" min="0" step="0.5" defaultValue={1} className={fieldClass} /></label><label className="text-xs font-medium text-slate-600">Cách dùng phòng tắm<select name={`bulk_${index}_bathroom_arrangement`} className={fieldClass}><option value="PRIVATE">Riêng</option><option value="SHARED">Dùng chung</option></select></label><label className="text-xs font-medium text-slate-600">Giá thuê tháng (₫)<input name={`bulk_${index}_rent`} type="number" min="1" className={fieldClass} /></label><label className="text-xs font-medium text-slate-600">Tiền đặt cọc (₫)<input name={`bulk_${index}_deposit`} type="number" min="0" className={fieldClass} /></label><label className="text-xs font-medium text-slate-600">Thời hạn thuê tối thiểu (tháng)<input name={`bulk_${index}_minimum_rental_months`} type="number" min="3" defaultValue={3} className={fieldClass} /></label><label className="text-xs font-medium text-slate-600">Số người tối đa<input name={`bulk_${index}_max_occupants`} type="number" min="1" className={fieldClass} /></label><label className="text-xs font-medium text-slate-600 sm:col-span-2">Mô tả<textarea name={`bulk_${index}_description`} rows={2} className={fieldClass} /></label><div className="sm:col-span-2"><p className="text-xs font-semibold text-slate-700">Tiện nghi căn này</p><div className="mt-2 flex flex-wrap gap-2">{catalog.filter((item) => item.scopes.includes("unit")).map((amenity) => <label key={amenity.key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"><input type="checkbox" name={`bulk_${index}_amenity:${amenity.key}`} className="size-4 accent-[#3368a0]" />{amenity.label}</label>)}</div><label className="mt-2 block text-xs text-slate-600">Tiện nghi riêng, mỗi dòng một mục<textarea name={`bulk_${index}_custom_amenities`} rows={2} className={fieldClass} /></label></div></fieldset>)}</div>}<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Xem trước {bulkPreviewLabels.length} căn. Mỗi căn có giá, diện tích, thời hạn thuê, mô tả và tiện nghi riêng.</p><button type="submit" disabled={busy || bulkPreviewLabels.length === 0 || bulkPreviewLabels.length > 50} className={buttonClass}>Tạo {bulkPreviewLabels.length || "các"} căn</button></form></section>}
          </div>}
        </div>

      </div>}

      {!creating && property && workspaceTab === "photos" && <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-900">Tải ảnh</h2><p className="mt-1 text-sm text-slate-600">JPG, PNG, WEBP · tối đa 8 MB mỗi ảnh · tối đa 20 ảnh</p><form onSubmit={uploadPhoto} className="mt-4 space-y-3"><label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-700"><span className="text-2xl text-[#3368a0]">↑</span><span className="mt-2 font-semibold">Kéo ảnh vào đây hoặc chọn tệp</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || media.length >= 20} onChange={(event) => { const incoming = Array.from(event.currentTarget.files ?? []); const additions = incoming.map((file) => ({ file, operationId: crypto.randomUUID() })); const next = [...pendingPhotos]; for (const photo of additions) { if (!next.some((item) => item.file.name === photo.file.name && item.file.size === photo.file.size && item.file.lastModified === photo.file.lastModified)) next.push(photo); } if (media.length + next.length - uploadedPhotoCount > 20 || incoming.some((file) => !/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) || file.size > 8 * 1024 * 1024)) { setError("Chọn ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 8 MB; tổng tối đa 20 ảnh."); } else { setPendingPhotos(next); setError(null); setNotice(null); } event.currentTarget.value = ""; }} className="mt-3 block max-w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-800" /></label>{pendingPhotos.length > 0 && <ul className="space-y-2">{pendingPhotos.map((photo, index) => <li key={photo.operationId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"><span className="min-w-0 truncate text-slate-700">{photo.file.name} <span className="text-xs text-slate-500">{index < uploadedPhotoCount ? "· Đã tải" : `· ${(photo.file.size / (1024 * 1024)).toFixed(1)} MB`}</span></span>{index >= uploadedPhotoCount && <button type="button" onClick={() => setPendingPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 text-rose-700 hover:underline">Xóa</button>}</li>)}</ul>}<label className="block text-sm font-medium text-slate-700">Lưu vào<select name="unit_id" className={fieldClass}><option value="">Ảnh dùng chung</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Chú thích<input name="caption" maxLength={500} className={fieldClass} /></label><button type="submit" disabled={busy || pendingPhotos.length === 0 || media.length >= 20} className={buttonClass}>{busy ? `Đang tải ảnh ${uploadedPhotoCount + 1}/${pendingPhotos.length}…` : `Tải ${pendingPhotos.length || "ảnh"} lên`}</button>{busy && <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Đang tải ảnh"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#3368a0]" /></div>}</form></section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Ảnh bất động sản</h2><p className="mt-1 text-sm text-slate-600">Thay đổi thứ tự bằng mũi tên; thay đổi được lưu ngay. Bấm nút để lưu lựa chọn hiển thị.</p></div><button type="button" onClick={() => void saveGallery()} disabled={busy || sharedMedia.length === 0} className={secondaryButtonClass}>Lưu lựa chọn hiển thị</button></div>{galleryItems.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Chưa có ảnh dùng chung.</p> : <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{galleryItems.map((item, index) => <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#d9e3ed] text-sm text-slate-500">{item.preview_url ? <Image src={item.preview_url} alt={item.caption || `Ảnh bất động sản ${index + 1}`} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" /> : <span>{item.mime_type.split("/")[1]?.toUpperCase() ?? "ẢNH"}</span>}</div><div className="space-y-3 p-3"><p className="truncate text-sm font-semibold text-slate-800">{item.caption || `Ảnh dùng chung ${index + 1}`}</p><p className="text-xs text-slate-500">{(item.size_bytes / (1024 * 1024)).toFixed(1)} MB</p><div className="flex items-center justify-between gap-2"><label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={item.is_selected_for_listing} onChange={(event) => setGalleryItems((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, is_selected_for_listing: event.target.checked } : candidate))} className="size-4 accent-[#3368a0]" />Hiển thị trên tin đăng</label><div className="flex gap-1"><button type="button" onClick={() => void moveGalleryItem(index, -1)} disabled={busy || galleryItems.length < 2 || index === 0} aria-label="Di chuyển ảnh lên" title={galleryItems.length < 2 ? "Cần ít nhất hai ảnh để sắp xếp" : "Di chuyển ảnh lên"} className="size-8 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40">↑</button><button type="button" onClick={() => void moveGalleryItem(index, 1)} disabled={busy || galleryItems.length < 2 || index === galleryItems.length - 1} aria-label="Di chuyển ảnh xuống" title={galleryItems.length < 2 ? "Cần ít nhất hai ảnh để sắp xếp" : "Di chuyển ảnh xuống"} className="size-8 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40">↓</button><button type="button" onClick={() => void removePhoto(item)} disabled={busy} className="size-8 rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Gỡ ảnh">×</button></div></div></div></li>)}</ol>}</section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-900">Ảnh các phòng</h2><p className="mt-1 text-sm text-slate-600">Chọn ảnh xuất hiện trên tin, sắp xếp thứ tự và gỡ ảnh cho từng phòng.</p>
            {units.filter((unit) => unitGalleryItems[unit.id]?.length).length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Chưa có ảnh phòng.</p> : <div className="mt-4 space-y-6">{units.filter((unit) => unitGalleryItems[unit.id]?.length).map((unit) => <section key={unit.id} aria-label={`Ảnh ${unit.label}`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-800">{unit.label}</h3><button type="button" onClick={() => void saveUnitGallery(unit.id)} disabled={busy} className={secondaryButtonClass}>Lưu lựa chọn</button></div><ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(unitGalleryItems[unit.id] ?? []).map((item, index) => <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200"><div className="relative flex aspect-[4/3] items-center justify-center bg-[#d9e3ed] text-sm text-slate-500">{item.preview_url ? <Image src={item.preview_url} alt={item.caption || `Ảnh ${unit.label} ${index + 1}`} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" /> : <span>{item.mime_type.split("/")[1]?.toUpperCase() ?? "ẢNH"}</span>}</div><div className="space-y-3 p-3"><p className="truncate text-sm font-semibold text-slate-800">{item.caption || `Ảnh ${index + 1}`}</p><label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={item.is_selected_for_listing} onChange={(event) => setUnitGalleryItems((current) => ({ ...current, [unit.id]: (current[unit.id] ?? []).map((photo) => photo.id === item.id ? { ...photo, is_selected_for_listing: event.target.checked } : photo) }))} className="size-4 accent-[#3368a0]" />Hiển thị trên tin đăng</label><div className="flex gap-1"><button type="button" onClick={() => void moveUnitGalleryItem(unit.id, index, -1)} disabled={busy || index === 0} aria-label={`Di chuyển ảnh ${unit.label} lên`} className="size-8 rounded-lg border border-slate-200 disabled:opacity-40">↑</button><button type="button" onClick={() => void moveUnitGalleryItem(unit.id, index, 1)} disabled={busy || index === (unitGalleryItems[unit.id]?.length ?? 0) - 1} aria-label={`Di chuyển ảnh ${unit.label} xuống`} className="size-8 rounded-lg border border-slate-200 disabled:opacity-40">↓</button><button type="button" onClick={() => void removePhoto(item)} disabled={busy} className="size-8 rounded-lg text-rose-700" aria-label={`Gỡ ảnh ${unit.label}`}>×</button></div></div></li>)}</ol></section>)}</div>}
          </section>
          <p className="text-sm text-slate-500">Bỏ chọn ảnh chỉ ẩn ảnh khỏi tin đăng; gỡ ảnh sẽ lưu lại tệp trong lịch sử.</p>
      </div>}
    </div>}

  </section>;
}
