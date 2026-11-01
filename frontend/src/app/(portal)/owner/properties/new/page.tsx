"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { VietnamLocationPicker } from "@/components/vietnam-location-picker";
import {
  ApiError,
  createOwnerProperty,
  createOwnerUnitBatch,
  getAmenityCatalog,
  getOwnerProperty,
  updateOwnerUnit,
  uploadOwnerMedia,
  type AmenityCatalogEntry,
  type AmenityDocument,
  type OwnerPropertyDetail,
} from "@/lib/auth-api";

const stages = [
  "Thông tin cơ bản về bất động sản",
  "Hình thức thuê và phân bổ căn",
  "Giá thuê và điều khoản",
  "Tiện ích, quy định và nội quy",
  "Hình ảnh và kiểm tra lại",
];
const inputClass = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-4 focus:ring-blue-100";
const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function read(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function numberFromForm(form: FormData, name: string, fallback: number | null = null): number | null {
  const value = read(form, name);
  return value === "" ? fallback : Number(value);
}

function documentFromForm(form: FormData, catalog: AmenityCatalogEntry[]): AmenityDocument {
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) => item.scopes.includes("shared"))) {
    if (form.get(`amenity:${amenity.key}`) === "on") {
      const details = read(form, `amenity_details:${amenity.key}`);
      standard[amenity.key] = { enabled: true, ...(details ? { details } : {}) };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: read(form, "custom_amenities").split("\n").map((item) => item.trim()).filter(Boolean),
  };
}

function unitAmenityDocumentFromForm(form: FormData, catalog: AmenityCatalogEntry[], index: number): AmenityDocument {
  const prefix = `new_${index}_`;
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) => item.scopes.includes("unit"))) {
    if (form.get(`${prefix}amenity:${amenity.key}`) === "on") {
      const details = read(form, `${prefix}details:${amenity.key}`);
      standard[amenity.key] = { enabled: true, ...(details ? { details } : {}) };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: read(form, `${prefix}custom_amenities`).split("\n").map((item) => item.trim()).filter(Boolean),
  };
}

export default function NewOwnerPropertyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<AmenityCatalogEntry[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [createdProperty, setCreatedProperty] = useState<OwnerPropertyDetail | null>(null);
  const [rentalArrangement, setRentalArrangement] = useState<"WHOLE_SPACE" | "SEPARATE_UNITS">("WHOLE_SPACE");
  const [unitCount, setUnitCount] = useState(1);
  const [unitPrefix, setUnitPrefix] = useState("Phòng");
  const [startNumber, setStartNumber] = useState(101);
  const [unitLabels, setUnitLabels] = useState<string[]>(["Phòng 101"]);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    let active = true;
    getAmenityCatalog().then((result) => { if (active) setCatalog(result); })
      .catch(() => { if (active) setError("Không thể tải danh sách tiện nghi."); })
      .finally(() => { if (active) setLoadingCatalog(false); });
    return () => { active = false; };
  }, []);

  const normalizedLabels = unitLabels.map((label) => label.trim().toLocaleLowerCase());
  const duplicateLabels = new Set(normalizedLabels.filter((label, index) => label && normalizedLabels.indexOf(label) !== index));

  function updateUnitDefaults(count: number, prefix: string, start: number) {
    setUnitCount(count);
    setUnitPrefix(prefix);
    setStartNumber(start);
    setUnitLabels(Array.from({ length: Math.min(Math.max(count, 1), 50) }, (_, index) => `${prefix.trim() || "Phòng"} ${start + index}`));
  }

  function goNext(form: HTMLFormElement) {
    if (step === 0 && !form.reportValidity()) return;
    if (step === 1 && rentalArrangement === "SEPARATE_UNITS" && (!unitLabels.length || duplicateLabels.size > 0 || unitLabels.some((label) => !label.trim()))) {
      setError("Kiểm tra tên căn: cần ít nhất một tên và không được trùng nhau.");
      return;
    }
    setError("");
    setFieldErrors({});
    setStep((current) => Math.min(current + 1, stages.length - 1));
  }

  async function submitWizard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < stages.length - 1) {
      goNext(event.currentTarget);
      return;
    }

    const form = new FormData(event.currentTarget);
    if (!read(form, "name")) {
      setError("Nhập tên bất động sản ở bước 1 trước khi lưu bản nháp.");
      setStep(0);
      return;
    }
    const files = selectedPhotos;
    if (files.length > 20 || files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setError("Chọn tối đa 20 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 8 MB.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");
    setFieldErrors({});
    let property = createdProperty;
    try {
      if (!property) {
        property = await createOwnerProperty({
          client_operation_id: crypto.randomUUID(),
          name: read(form, "name"),
          property_type: read(form, "property_type"),
          rental_arrangement: rentalArrangement,
          address_line: read(form, "address_line") || null,
          city: read(form, "city") || null,
          ward: read(form, "ward") || null,
          description: read(form, "description") || null,
          shared_amenities: documentFromForm(form, catalog),
          policies: {
            schema_version: 1,
            pets: read(form, "pets"),
            smoking: read(form, "smoking"),
            shared_rules: read(form, "shared_rules").split("\n").map((item) => item.trim()).filter(Boolean),
          },
        });
        setCreatedProperty(property);
      }

      if (!setupComplete && property && createdProperty) {
        setError("Bản nháp đã được tạo nhưng chưa hoàn tất các căn. Mở bất động sản để tiếp tục trong mục Danh sách căn.");
        return;
      }

      if (!setupComplete) {
        if (!property) throw new Error("Property setup did not return a record.");
        const rent = numberFromForm(form, "rent");
        const deposit = numberFromForm(form, "deposit");
        const minMonths = numberFromForm(form, "minimum_rental_months", 3) ?? 3;
        const maxOccupants = numberFromForm(form, "max_occupants");
        if (rentalArrangement === "SEPARATE_UNITS") {
          await createOwnerUnitBatch(property.id, {
            expected_content_revision: property.content_revision,
            client_operation_id: crypto.randomUUID(),
            units: unitLabels.map((label, index) => ({
              client_operation_id: crypto.randomUUID(),
              label: read(form, `new_${index}_label`) || label.trim(),
              unit_kind: read(form, `new_${index}_unit_kind`) || read(form, "unit_kind") || "ROOM",
              description: read(form, `new_${index}_description`) || null,
              bedrooms: numberFromForm(form, `new_${index}_bedrooms`, numberFromForm(form, "bedrooms", 0)) ?? 0,
              bathrooms: numberFromForm(form, `new_${index}_bathrooms`, numberFromForm(form, "bathrooms", 1)) ?? 1,
              bathroom_arrangement: read(form, `new_${index}_bathroom_arrangement`) || read(form, "bathroom_arrangement") || "PRIVATE",
              minimum_rental_months: numberFromForm(form, `new_${index}_minimum_rental_months`, minMonths) ?? minMonths,
              advertised_monthly_rent: numberFromForm(form, `new_${index}_rent`, rent),
              deposit: numberFromForm(form, `new_${index}_deposit`, deposit),
              max_occupants: numberFromForm(form, `new_${index}_max_occupants`, maxOccupants),
              area_m2: numberFromForm(form, `new_${index}_area_m2`, numberFromForm(form, "area_m2")),
              amenities: unitAmenityDocumentFromForm(form, catalog, index),
              policy_overrides: {
                additional_rules: read(form, `new_${index}_additional_rules`).split("\n").map((rule) => rule.trim()).filter(Boolean),
              },
            })),
          });
        } else {
          const wholeSpaceUnit = property.units.find((unit) => !unit.archived_at);
          if (wholeSpaceUnit) {
            await updateOwnerUnit(property.id, wholeSpaceUnit.id, {
              expected_content_revision: property.content_revision,
              area_m2: numberFromForm(form, "area_m2"),
              bedrooms: numberFromForm(form, "bedrooms", 0) ?? 0,
              bathrooms: numberFromForm(form, "bathrooms", 1) ?? 1,
              bathroom_arrangement: read(form, "bathroom_arrangement") || "PRIVATE",
              advertised_monthly_rent: rent,
              deposit,
              minimum_rental_months: minMonths,
              max_occupants: maxOccupants,
            });
          }
        }
        property = await getOwnerProperty(property.id);
        setCreatedProperty(property);
        setSetupComplete(true);
      }

      if (setupComplete) property = await getOwnerProperty(property.id);
      if (files.length === 0) {
        setStatus("Bản nháp đã được lưu. Chọn ảnh ở trên rồi bấm ‘Tiếp tục tải ảnh’ để tải lên.");
        return;
      }
      for (const file of files.slice(uploadedCount)) {
        await uploadOwnerMedia(property.id, {
          file,
          client_operation_id: crypto.randomUUID(),
          expected_content_revision: property.content_revision,
        });
        setUploadedCount((count) => count + 1);
        property = await getOwnerProperty(property.id);
        setCreatedProperty(property);
      }
      router.push("/owner/properties");
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors);
      } else {
        setError(property
          ? "Bản nháp đã được tạo nhưng tải ảnh thất bại. Kiểm tra kết nối rồi tiếp tục tải ảnh trong bất động sản này."
          : "Không thể tạo bất động sản. Vui lòng thử lại.");
      }
    } finally {
      setSaving(false);
    }
  }

  const shellClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
  const amenityEntries = catalog.filter((item) => item.scopes.includes("shared"));

  return <section className="mx-auto w-full max-w-6xl py-3 sm:py-5">
    <p className="text-sm text-slate-500">Không gian quản lý / Chủ nhà / <a href="/owner/properties" className="text-[#3368a0] hover:underline">Bất động sản</a> / Tạo bất động sản</p>
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Thêm bất động sản mới</h1><p className="mt-1 text-sm text-slate-600">Tạo bản nháp trước; bạn có thể bổ sung thông tin sau.</p></div><span className="text-xs font-semibold text-slate-500">Bước {step + 1} / {stages.length}</span></div>

    <form onSubmit={submitWizard} className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <h2 className="font-semibold text-slate-900">Các bước đăng ký</h2>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#3368a0] transition-all" style={{ width: `${((step + 1) / stages.length) * 100}%` }} /></div>
        <ol className="space-y-2">{stages.map((stage, index) => <li key={stage}><button type="button" onClick={() => { setError(""); setStep(index); }} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-medium ${step === index ? "border-[#3368a0] bg-blue-50 text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === index ? "bg-[#3368a0] text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span>{stage}</button></li>)}</ol>
        <p className="text-sm leading-6 text-slate-500">Bản nháp vẫn có thể thiếu thông tin và chưa được đăng công khai.</p>
      </aside>

      <div className={shellClass}>
        <div className="mb-6 border-b border-slate-200 pb-4"><h2 className="text-xl font-bold text-slate-900">{stages[step]}</h2><p className="mt-1 text-sm text-slate-600">{step === 0 ? "Nhập thông tin cơ bản và địa chỉ." : step === 1 ? "Chọn cho thuê nguyên căn hay từng căn riêng lẻ." : step === 2 ? "Nhập giá và điều khoản mặc định; có thể chỉnh từng căn sau." : step === 3 ? "Các tiện nghi và quy định này áp dụng chung cho bất động sản." : "Thêm ảnh dùng chung rồi kiểm tra bản nháp trước khi lưu."}</p></div>

        <div hidden={step !== 0} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Tên bất động sản<input name="name" required maxLength={255} className={inputClass} placeholder="Ví dụ: Căn hộ gần biển Mỹ Khê" /></label>
          <label className="block text-sm font-semibold text-slate-700">Loại hình bất động sản<select name="property_type" className={inputClass} defaultValue="APARTMENT"><option value="HOUSE">Nhà</option><option value="APARTMENT">Căn hộ</option><option value="APARTMENT_BUILDING">Tòa nhà căn hộ</option></select></label>
          <label className="block text-sm font-semibold text-slate-700">Mô tả chi tiết<textarea name="description" rows={3} maxLength={10000} className={inputClass} placeholder="Mô tả vị trí, không gian và điểm nổi bật." /></label>
          <VietnamLocationPicker required={false} />
          <label className="block text-sm font-semibold text-slate-700">Địa chỉ cụ thể<input name="address_line" maxLength={500} className={inputClass} placeholder="Số nhà, tên đường" /></label>
        </div>

        <div hidden={step !== 1} className="space-y-5">
          <fieldset className="space-y-3"><legend className="text-sm font-semibold text-slate-700">Hình thức cho thuê</legend><label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="rental_arrangement" value="WHOLE_SPACE" checked={rentalArrangement === "WHOLE_SPACE"} onChange={() => setRentalArrangement("WHOLE_SPACE")} className="mt-1 accent-[#3368a0]" /><span><strong className="block text-sm text-slate-900">Toàn bộ không gian</strong><span className="mt-1 block text-sm text-slate-600">Tạo một căn đại diện cho toàn bộ bất động sản.</span></span></label><label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="rental_arrangement" value="SEPARATE_UNITS" checked={rentalArrangement === "SEPARATE_UNITS"} onChange={() => setRentalArrangement("SEPARATE_UNITS")} className="mt-1 accent-[#3368a0]" /><span><strong className="block text-sm text-slate-900">Từng căn riêng lẻ</strong><span className="mt-1 block text-sm text-slate-600">Tạo danh sách phòng có nhãn riêng.</span></span></label></fieldset>
          {rentalArrangement === "SEPARATE_UNITS" && <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700">Số lượng<input type="number" min={1} max={50} value={unitCount} onChange={(event) => updateUnitDefaults(Number(event.target.value) || 1, unitPrefix, startNumber)} className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Tiền tố<input value={unitPrefix} onChange={(event) => updateUnitDefaults(unitCount, event.target.value, startNumber)} className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Số bắt đầu<input type="number" value={startNumber} onChange={(event) => updateUnitDefaults(unitCount, unitPrefix, Number(event.target.value) || 1)} className={inputClass} /></label></div>}
          {rentalArrangement === "SEPARATE_UNITS" && <div><h3 className="mb-2 text-sm font-semibold text-slate-800">Xem trước và chỉnh sửa tên căn</h3><div className="grid gap-2 sm:grid-cols-2">{unitLabels.map((label, index) => <input key={index} aria-label={`Tên căn ${index + 1}`} value={label} onChange={(event) => setUnitLabels((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className={`${inputClass} mt-0 ${duplicateLabels.has(label.trim().toLocaleLowerCase()) ? "border-rose-500 bg-rose-50" : ""}`} />)}</div></div>}
        </div>

        <div hidden={step !== 2} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Giá thuê tháng (₫)<input name="rent" type="number" min={1} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700">Tiền đặt cọc (₫)<input name="deposit" type="number" min={0} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700">Số tháng tối thiểu<input name="minimum_rental_months" type="number" min={3} defaultValue={3} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700">Số người tối đa<input name="max_occupants" type="number" min={1} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700">Loại căn<select name="unit_kind" className={inputClass}><option value="ROOM">Phòng</option><option value="STUDIO">Studio</option><option value="APARTMENT">Căn hộ</option><option value="HOUSE">Nhà</option></select></label>
          <label className="text-sm font-semibold text-slate-700">Diện tích m²<input name="area_m2" type="number" min={0.1} step={0.1} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700">Phòng ngủ<input name="bedrooms" type="number" min={0} defaultValue={0} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700">Phòng tắm<input name="bathrooms" type="number" min={0} defaultValue={1} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Sắp xếp phòng tắm<select name="bathroom_arrangement" className={inputClass}><option value="PRIVATE">Riêng</option><option value="SHARED">Dùng chung</option></select></label>
          {rentalArrangement === "SEPARATE_UNITS" && unitLabels.map((label, index) => <fieldset key={`${index}-${label}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:col-span-2 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold text-slate-800">Căn {index + 1} · {label}</legend><label className="text-sm font-medium text-slate-700">Tên căn<input name={`new_${index}_label`} value={label} onChange={(event) => setUnitLabels((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Loại căn<select name={`new_${index}_unit_kind`} defaultValue="ROOM" className={inputClass}><option value="ROOM">Phòng</option><option value="STUDIO">Studio</option><option value="APARTMENT">Căn hộ</option><option value="HOUSE">Nhà</option></select></label><label className="text-sm font-medium text-slate-700">Diện tích (m²)<input name={`new_${index}_area_m2`} type="number" min="0.1" step="0.1" className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Giá thuê tháng (₫)<input name={`new_${index}_rent`} type="number" min="1" className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Tiền đặt cọc (₫)<input name={`new_${index}_deposit`} type="number" min="0" className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Thời hạn thuê tối thiểu<input name={`new_${index}_minimum_rental_months`} type="number" min="3" defaultValue={3} className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Số người tối đa<input name={`new_${index}_max_occupants`} type="number" min="1" className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Phòng ngủ<input name={`new_${index}_bedrooms`} type="number" min="0" defaultValue={0} className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Phòng tắm<input name={`new_${index}_bathrooms`} type="number" min="0" defaultValue={1} className={inputClass} /></label><label className="text-sm font-medium text-slate-700">Cách dùng phòng tắm<select name={`new_${index}_bathroom_arrangement`} className={inputClass}><option value="PRIVATE">Riêng</option><option value="SHARED">Dùng chung</option></select></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Mô tả căn<textarea name={`new_${index}_description`} rows={2} className={inputClass} /></label><div className="sm:col-span-2"><p className="text-sm font-semibold text-slate-800">Tiện nghi trong căn</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{catalog.filter((amenity) => amenity.scopes.includes("unit")).map((amenity) => <label key={amenity.key} className="rounded-lg border border-slate-200 p-2 text-xs"><span className="inline-flex items-center gap-2"><input type="checkbox" name={`new_${index}_amenity:${amenity.key}`} className="size-4 accent-[#3368a0]" />{amenity.label}</span><input type="text" name={`new_${index}_details:${amenity.key}`} aria-label={`Ghi chú ${amenity.label}`} maxLength={160} placeholder="Ghi chú tùy chọn" className={`${inputClass} mt-2`} /></label>)}</div><label className="mt-2 block text-sm text-slate-700">Tiện nghi riêng, mỗi dòng một mục<textarea name={`new_${index}_custom_amenities`} rows={2} className={inputClass} /></label><label className="mt-2 block text-sm text-slate-700">Quy định riêng, mỗi dòng một mục<textarea name={`new_${index}_additional_rules`} rows={2} className={inputClass} /></label></div></fieldset>)}
        </div>

        <div hidden={step !== 3} className="space-y-6">
          <fieldset><legend className="mb-3 text-sm font-semibold text-slate-800">Tiện nghi dùng chung</legend>{loadingCatalog ? <p className="text-sm text-slate-500">Đang tải tiện nghi…</p> : <div className="grid gap-2 sm:grid-cols-2">{amenityEntries.map((amenity) => <label key={amenity.key} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><span className="inline-flex items-center gap-2"><input type="checkbox" name={`amenity:${amenity.key}`} className="size-4 accent-[#3368a0]" />{amenity.label}</span><input type="text" name={`amenity_details:${amenity.key}`} maxLength={160} aria-label={`Ghi chú ${amenity.label}`} placeholder="Ghi chú tùy chọn" className={`${inputClass} mt-2`} /></label>)}</div>}</fieldset>
          <label className="block text-sm font-semibold text-slate-700">Tiện nghi riêng, mỗi dòng một mục<textarea name="custom_amenities" rows={3} className={inputClass} placeholder="Ví dụ: Ban công hướng biển" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Thú cưng<select name="pets" defaultValue="NOT_ALLOWED" className={inputClass}><option value="NOT_ALLOWED">Không cho phép</option><option value="WITH_APPROVAL">Cần phê duyệt</option><option value="ALLOWED">Được phép</option></select></label><label className="text-sm font-semibold text-slate-700">Hút thuốc<select name="smoking" defaultValue="NOT_ALLOWED" className={inputClass}><option value="NOT_ALLOWED">Không cho phép</option><option value="OUTDOOR_ONLY">Chỉ ngoài trời</option><option value="ALLOWED">Được phép</option></select></label></div>
          <label className="block text-sm font-semibold text-slate-700">Quy định dùng chung<textarea name="shared_rules" rows={3} className={inputClass} placeholder="Mỗi dòng một quy định" /></label>
        </div>

        <div hidden={step !== 4} className="space-y-4">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-700"><span className="text-3xl text-[#3368a0]">↑</span><span className="mt-2 font-semibold">Kéo ảnh vào đây hoặc chọn tệp</span><span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP · tối đa 8 MB mỗi ảnh · tối đa 20 ảnh</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { const incoming = Array.from(event.currentTarget.files ?? []); const next = [...selectedPhotos]; for (const file of incoming) { if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file); } if (next.length > 20 || incoming.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) { setError("Chọn tối đa 20 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 8 MB."); } else { setSelectedPhotos(next); setError(""); setStatus(""); } event.currentTarget.value = ""; }} className="mt-4 max-w-full text-xs" /></label>
          {selectedPhotos.length > 0 && <ul className="space-y-2" aria-label="Ảnh đã chọn">{selectedPhotos.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"><span className="min-w-0 truncate text-slate-700">{file.name} <span className="text-xs text-slate-500">({index < uploadedCount ? "Đã tải" : `${(file.size / 1024 / 1024).toFixed(1)} MB`})</span></span>{index >= uploadedCount && <button type="button" onClick={() => setSelectedPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 text-sm font-medium text-rose-700 hover:underline">Xóa</button>}</li>)}</ul>}
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><strong>Kiểm tra trước khi lưu</strong><ul className="mt-2 list-disc space-y-1 pl-5"><li>Thông tin bất động sản và địa chỉ đã được nhập ở bước 1.</li><li>{rentalArrangement === "WHOLE_SPACE" ? "Một căn toàn bộ không gian sẽ được tạo tự động." : `${unitLabels.length} căn sẽ được tạo từ danh sách xem trước.`}</li><li>Giá và điều khoản được lưu cùng các căn.</li><li>Tiện nghi, chính sách và nội quy dùng chung đã sẵn sàng.</li></ul></div>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}{createdProperty && <button type="button" onClick={() => router.push("/owner/properties")} className="ml-2 font-semibold underline">Mở bất động sản đã tạo</button>}</div>}
        {status && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{status}</p>}
        {Object.entries(fieldErrors).length > 0 && <ul role="alert" className="mt-3 list-disc rounded-xl border border-rose-200 bg-rose-50 px-8 py-3 text-sm text-rose-800">{Object.entries(fieldErrors).map(([field, messages]) => <li key={field}>{field}: {messages[0]}</li>)}</ul>}
        {uploadedCount > 0 && <p className="mt-3 text-sm text-slate-600" role="status">Đã tải {uploadedCount} ảnh.</p>}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => router.push("/owner/properties")} className={secondaryButton}>Hủy</button><div className="flex gap-3">{step > 0 && <button type="button" onClick={() => { setError(""); setStep((current) => current - 1); }} className={secondaryButton}>Quay lại</button>}{step < stages.length - 1 ? <button type="button" onClick={(event) => { const form = event.currentTarget.form; if (form) goNext(form); }} className={secondaryButton}>Bước tiếp theo →</button> : setupComplete && createdProperty ? <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Đang tải ảnh…" : "Tiếp tục tải ảnh"}</button> : createdProperty ? <button type="button" onClick={() => router.push("/owner/properties")} className={primaryButton}>Mở bất động sản đã tạo</button> : <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Đang lưu bất động sản…" : "Tạo bản nháp"}</button>}</div></div>
      </div>
    </form>
  </section>;
}
