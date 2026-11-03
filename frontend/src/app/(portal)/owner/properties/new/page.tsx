"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
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
  "Thông tin cơ bản",
  "Hình thức thuê",
  "Tiện ích chung",
  "Quy định và nội quy",
  "Kiểm tra lại",
];
const stageDescriptions = [
  "Cung cấp tên, loại hình, mô tả và địa chỉ của bất động sản.",
  "Chọn cách cho thuê, nhập giá mặc định và tùy chỉnh riêng từng căn nếu cần.",
  "Chọn tiện ích cho toàn bộ bất động sản hoặc riêng trong căn/phòng.",
  "Thiết lập chính sách chung và nội quy bổ sung cho từng căn.",
  "Thêm ảnh dùng chung và xem lại thông tin trước khi lưu bản nháp.",
];
const inputClass = "mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100";
const textareaClass = inputClass.replace("mt-2", "mt-3");
const selectClass = `${inputClass} cursor-pointer appearance-none bg-no-repeat bg-[length:1.125rem_1.125rem] pr-12`;
const selectStyle: CSSProperties = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='m6 8 4 4 4-4' stroke='%23475569' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 0.875rem center",
};
type RoomDraft = {
  label: string;
  labelEdited: boolean;
  customized: boolean;
  unit_kind: string;
  area_m2: string;
  rent: string;
  deposit: string;
  minimum_rental_months: string;
  max_occupants: string;
  bedrooms: string;
  bathrooms: string;
  description: string;
};

function emptyRoom(label: string): RoomDraft {
  return {
    label,
    labelEdited: false,
    customized: false,
    unit_kind: "ROOM",
    area_m2: "",
    rent: "",
    deposit: "",
    minimum_rental_months: "3",
    max_occupants: "1",
    bedrooms: "0",
    bathrooms: "1",
    description: "",
  };
}

const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

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

function unitAmenityDocumentFromForm(form: FormData, catalog: AmenityCatalogEntry[], excludedKeys: ReadonlySet<string> = new Set()): AmenityDocument {
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) => item.scopes.includes("unit"))) {
    if (form.get(`unit_amenity:${amenity.key}`) === "on" && !excludedKeys.has(amenity.key)) {
      const details = read(form, `unit_amenity_details:${amenity.key}`);
      standard[amenity.key] = { enabled: true, ...(details ? { details } : {}) };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: read(form, "unit_custom_amenities").split("\n").map((item) => item.trim()).filter(Boolean),
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
  const [rooms, setRooms] = useState<RoomDraft[]>([emptyRoom("Phòng 101")]);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [sharedAmenityKeys, setSharedAmenityKeys] = useState<Set<string>>(() => new Set());
  const [amenityScope, setAmenityScope] = useState<"property" | "unit">("property");
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    let active = true;
    getAmenityCatalog().then((result) => { if (active) setCatalog(result); })
      .catch(() => { if (active) setError("Không thể tải danh sách tiện nghi."); })
      .finally(() => { if (active) setLoadingCatalog(false); });
    return () => { active = false; };
  }, []);

  const unitLabels = rooms.map((room) => room.label);
  const normalizedLabels = unitLabels.map((label) => label.trim().toLocaleLowerCase());
  const duplicateLabels = new Set(normalizedLabels.filter((label, index) => label && normalizedLabels.indexOf(label) !== index));

  function updateUnitDefaults(count: number, prefix: string, start: number) {
    const nextCount = Math.min(Math.max(count, 1), 50);
    setUnitCount(nextCount);
    setUnitPrefix(prefix);
    setStartNumber(start);
    setRooms((current) => Array.from({ length: nextCount }, (_, index) => {
      const generated = `${prefix.trim() || "Phòng"} ${start + index}`;
      const existing = current[index];
      if (!existing) return emptyRoom(generated);
      return { ...existing, label: existing.labelEdited ? existing.label : generated };
    }));
    setActiveUnitIndex((current) => Math.min(current, nextCount - 1));
  }

  function updateRoom(index: number, patch: Partial<RoomDraft>, customized = true) {
    setRooms((current) => current.map((room, roomIndex) => roomIndex === index ? { ...room, ...patch, customized: customized || room.customized } : room));
  }

  function applyRoomToEmpty(index: number) {
    const source = rooms[index];
    if (!source) return;
    setRooms((current) => current.map((room, roomIndex) => {
      if (roomIndex === index || room.customized) return room;
      return { ...source, label: room.label, labelEdited: room.labelEdited, customized: false };
    }));
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
        const maxOccupants = numberFromForm(form, "max_occupants", 1);
        if (rentalArrangement === "SEPARATE_UNITS") {
          await createOwnerUnitBatch(property.id, {
            expected_content_revision: property.content_revision,
            client_operation_id: crypto.randomUUID(),
            units: rooms.map((room, index) => ({
              client_operation_id: crypto.randomUUID(),
              label: room.label.trim(),
              unit_kind: room.unit_kind || "ROOM",
              description: room.description.trim() || null,
              bedrooms: room.bedrooms === "" ? 0 : Number(room.bedrooms),
              bathrooms: room.bathrooms === "" ? 1 : Number(room.bathrooms),
              bathroom_arrangement: "PRIVATE",
              minimum_rental_months: room.minimum_rental_months === "" ? minMonths : Number(room.minimum_rental_months),
              advertised_monthly_rent: room.rent === "" ? null : Number(room.rent),
              deposit: room.deposit === "" ? null : Number(room.deposit),
              max_occupants: room.max_occupants === "" ? 1 : Number(room.max_occupants),
              area_m2: room.area_m2 === "" ? null : Number(room.area_m2),
              amenities: unitAmenityDocumentFromForm(form, catalog, sharedAmenityKeys),
              policy_overrides: {
                additional_rules: read(form, `new_${index}_additional_rules`).split("\n").map((rule) => rule.trim()).filter(Boolean)
                  .filter((rule) => !read(form, "shared_rules").split("\n").some((sharedRule) => sharedRule.trim().normalize("NFC").toLocaleLowerCase("vi") === rule.normalize("NFC").toLocaleLowerCase("vi"))),
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
              bathroom_arrangement: "PRIVATE",
              advertised_monthly_rent: rent,
              deposit,
              minimum_rental_months: minMonths,
              max_occupants: maxOccupants,
              amenities: unitAmenityDocumentFromForm(form, catalog, sharedAmenityKeys),
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
      router.push(`/owner/properties/${property.id}`);
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

  const shellClass = "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm";
  const amenityEntries = catalog.filter((item) => item.scopes.includes("shared"));
  const unitAmenityEntries = catalog.filter((item) => item.scopes.includes("unit") && !sharedAmenityKeys.has(item.key));

  return <section className="mx-auto w-full max-w-6xl py-3 sm:py-5">
    <p className="text-sm text-slate-500">Không gian quản lý / Chủ nhà / <a href="/owner/properties" className="text-[#3368a0] hover:underline">Bất động sản</a> / Tạo bất động sản</p>
    <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#3368a0]">Tạo bản nháp</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Thêm bất động sản mới</h1><p className="mt-1 text-sm text-slate-600">Cung cấp thông tin cơ bản, hình thức cho thuê và tiện ích để bắt đầu tìm người thuê.</p></div>

    <form onSubmit={submitWizard} className="mt-6 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-slate-900">Các bước đăng ký</h2><span className="text-xs text-slate-500">Bước {step + 1} / {stages.length}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#3368a0] transition-[width]" style={{ width: `${((step + 1) / stages.length) * 100}%` }} /></div>
        <ol aria-label="Các bước tạo bất động sản" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{stages.map((stage, index) => <li key={stage}><button type="button" aria-label={stage} aria-current={step === index ? "step" : undefined} onClick={() => { setError(""); setStep(index); }} className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors sm:text-sm ${step === index ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}><span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === index ? "bg-[#3368a0] text-white" : index < step ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{index < step ? "✓" : index + 1}</span><span>{stage}</span></button></li>)}</ol>
        <p className="hidden text-xs leading-5 text-slate-500 lg:block">Bạn có thể lưu bản nháp và tiếp tục hoàn thiện bất cứ lúc nào.</p>
      </aside>

      <div className={shellClass}>
        <header className="border-b border-slate-200 px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-slate-900 sm:text-xl">{stages[step]}</h2><p className="mt-1 text-xs text-slate-600 sm:text-sm">{stageDescriptions[step]}</p></header>
        <div className="m-4 space-y-5 rounded-xl bg-slate-50 p-4 sm:m-5 sm:p-5">

        <div hidden={step !== 0} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Tên bất động sản<input name="name" required maxLength={255} className={inputClass} placeholder="Ví dụ: Căn hộ gần biển Mỹ Khê" /></label>
          <label className="block text-sm font-semibold text-slate-700">Loại hình bất động sản<select name="property_type" className={selectClass} style={selectStyle} defaultValue="APARTMENT"><option value="HOUSE">Nhà</option><option value="APARTMENT">Căn hộ</option><option value="APARTMENT_BUILDING">Tòa nhà căn hộ</option></select></label>
          <label className="block text-sm font-semibold text-slate-700">Mô tả chi tiết<textarea name="description" rows={3} maxLength={10000} className={textareaClass} placeholder="Mô tả vị trí, không gian và điểm nổi bật." /></label>
          <VietnamLocationPicker required={false} />
          <label className="block text-sm font-semibold text-slate-700">Địa chỉ cụ thể<input name="address_line" maxLength={500} className={inputClass} placeholder="Số nhà, tên đường" /></label>
        </div>

        <div hidden={step !== 1} className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">Hình thức cho thuê</legend>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <input type="radio" name="rental_arrangement" value="WHOLE_SPACE" checked={rentalArrangement === "WHOLE_SPACE"} onChange={() => setRentalArrangement("WHOLE_SPACE")} className="mt-1 accent-[#3368a0]" />
              <span><strong className="block text-sm text-slate-900">Toàn bộ không gian</strong><span className="mt-1 block text-sm text-slate-600">Cho thuê toàn bộ căn nhà hoặc căn hộ.</span></span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <input type="radio" name="rental_arrangement" value="SEPARATE_UNITS" checked={rentalArrangement === "SEPARATE_UNITS"} onChange={() => setRentalArrangement("SEPARATE_UNITS")} className="mt-1 accent-[#3368a0]" />
              <span><strong className="block text-sm text-slate-900">Cho thuê từng căn/phòng</strong><span className="mt-1 block text-sm text-slate-600">Tạo nhiều căn/phòng trong cùng bất động sản.</span></span>
            </label>
          </fieldset>
          {rentalArrangement === "WHOLE_SPACE" ? <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">Thông tin căn</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Giá thuê tháng (₫)<input name="rent" type="number" min={1} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Tiền đặt cọc (₫)<input name="deposit" type="number" min={0} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Thời hạn thuê tối thiểu (tháng)<input name="minimum_rental_months" type="number" min={3} defaultValue={3} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Số người tối đa<input name="max_occupants" type="number" min={1} defaultValue={1} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Loại căn<select name="unit_kind" className={selectClass} style={selectStyle}><option value="ROOM">Phòng</option><option value="STUDIO">Studio</option><option value="APARTMENT">Căn hộ</option><option value="HOUSE">Nhà</option></select></label>
              <label className="text-sm font-medium text-slate-700">Diện tích (m²)<input name="area_m2" type="number" min={0.1} step={0.1} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Phòng ngủ<input name="bedrooms" type="number" min={0} defaultValue={0} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Phòng tắm<input name="bathrooms" type="number" min={0} defaultValue={1} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Mô tả<textarea name="unit_description" rows={2} className={textareaClass} /></label>
            </div>
          </section> : <>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">Danh sách căn/phòng</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Số lượng<input type="number" min={1} max={50} value={unitCount} onChange={(event) => updateUnitDefaults(Number(event.target.value) || 1, unitPrefix, startNumber)} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Tiền tố<input value={unitPrefix} onChange={(event) => updateUnitDefaults(unitCount, event.target.value, startNumber)} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Số bắt đầu<input type="number" value={startNumber} onChange={(event) => updateUnitDefaults(unitCount, unitPrefix, Number(event.target.value) || 1)} className={inputClass} /></label>
              </div>
              <p className="mt-3 text-xs text-slate-500">Chọn từng phòng bên dưới để nhập thông tin. Có thể sao chép phòng đang xem sang các phòng chưa chỉnh.</p>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Tùy chỉnh từng căn</h3><p className="mt-1 text-xs text-slate-500">Thời hạn thuê tối thiểu là 3 tháng và số người tối đa là 1, trừ khi bạn đổi.</p></div><span className="shrink-0 text-xs text-slate-500">{activeUnitIndex + 1} / {rooms.length}</span></div>
              <div role="tablist" aria-label="Chọn căn để tùy chỉnh" className="mt-3 flex gap-2 overflow-x-auto pb-2">{rooms.map((room, index) => <button key={index} type="button" role="tab" aria-selected={activeUnitIndex === index} onClick={() => setActiveUnitIndex(index)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${activeUnitIndex === index ? "border-[#3368a0] bg-[#3368a0] text-white" : "border-slate-200 bg-white text-slate-700"}`}>{room.label.trim() || `Căn ${index + 1}`}</button>)}</div>
              {rooms.map((room, index) => <fieldset key={index} role="tabpanel" hidden={activeUnitIndex !== index} className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
                <legend className="sr-only">Tùy chỉnh {room.label || `căn ${index + 1}`}</legend>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">Tên căn<input aria-label={`Tên căn ${index + 1}`} name={`new_${index}_label`} value={room.label} onChange={(event) => updateRoom(index, { label: event.target.value, labelEdited: true }, false)} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Loại căn<select name={`new_${index}_unit_kind`} value={room.unit_kind} onChange={(event) => updateRoom(index, { unit_kind: event.target.value })} className={selectClass} style={selectStyle}><option value="ROOM">Phòng</option><option value="STUDIO">Studio</option><option value="APARTMENT">Căn hộ</option><option value="HOUSE">Nhà</option></select></label>
                <label className="text-sm font-medium text-slate-700">Diện tích (m²)<input name={`new_${index}_area_m2`} type="number" min="0.1" step="0.1" value={room.area_m2} onChange={(event) => updateRoom(index, { area_m2: event.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Giá thuê tháng (₫)<input name={`new_${index}_rent`} type="number" min="1" value={room.rent} onChange={(event) => updateRoom(index, { rent: event.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Tiền đặt cọc (₫)<input name={`new_${index}_deposit`} type="number" min="0" value={room.deposit} onChange={(event) => updateRoom(index, { deposit: event.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Thời hạn thuê tối thiểu<input name={`new_${index}_minimum_rental_months`} type="number" min="3" value={room.minimum_rental_months} onChange={(event) => updateRoom(index, { minimum_rental_months: event.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Số người tối đa<input name={`new_${index}_max_occupants`} type="number" min="1" value={room.max_occupants} onChange={(event) => updateRoom(index, { max_occupants: event.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Phòng ngủ<input name={`new_${index}_bedrooms`} type="number" min="0" value={room.bedrooms} onChange={(event) => updateRoom(index, { bedrooms: event.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Phòng tắm<input name={`new_${index}_bathrooms`} type="number" min="0" value={room.bathrooms} onChange={(event) => updateRoom(index, { bathrooms: event.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">Mô tả<textarea name={`new_${index}_description`} rows={2} value={room.description} onChange={(event) => updateRoom(index, { description: event.target.value })} className={textareaClass} /></label>
                <div className="sm:col-span-2"><button type="button" onClick={() => applyRoomToEmpty(index)} className={secondaryButton}>Áp dụng cho các phòng chưa chỉnh riêng</button></div>
              </fieldset>)}
            </section>
          </>}
        </div>

        <div hidden={step !== 2} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Tiện ích của bất động sản và căn/phòng</h3><p className="mt-1 text-xs text-slate-500">Chọn phạm vi bên dưới. Tiện ích ở bất động sản sẽ không lặp lại trong căn.</p></div></div>
          <div role="tablist" aria-label="Phạm vi tiện ích" className="flex gap-2 border-b border-slate-200 pb-2"><button type="button" role="tab" aria-selected={amenityScope === "property"} onClick={() => setAmenityScope("property")} className={`rounded-lg border px-4 py-2 text-sm font-medium ${amenityScope === "property" ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 bg-white text-slate-600"}`}>Toàn bất động sản</button><button type="button" role="tab" aria-selected={amenityScope === "unit"} onClick={() => setAmenityScope("unit")} className={`rounded-lg border px-4 py-2 text-sm font-medium ${amenityScope === "unit" ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 bg-white text-slate-600"}`}>Trong căn/phòng</button></div>
          <div hidden={amenityScope !== "property"} role="tabpanel" className="space-y-4"><fieldset><legend className="mb-3 text-sm font-semibold text-slate-800">Tiện ích dùng chung</legend>{loadingCatalog ? <p className="text-sm text-slate-500">Đang tải tiện ích…</p> : <div className="grid gap-2 sm:grid-cols-2">{amenityEntries.map((amenity) => <label key={amenity.key} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"><span className="inline-flex items-center gap-2"><input type="checkbox" name={`amenity:${amenity.key}`} checked={sharedAmenityKeys.has(amenity.key)} onChange={(event) => setSharedAmenityKeys((current) => { const next = new Set(current); if (event.target.checked) next.add(amenity.key); else next.delete(amenity.key); return next; })} className="size-4 accent-[#3368a0]" />{amenity.label}</span><input type="text" name={`amenity_details:${amenity.key}`} maxLength={160} aria-label={`Ghi chú ${amenity.label}`} placeholder="Ghi chú tùy chọn" className={inputClass} /></label>)}</div>}</fieldset><label className="block text-sm font-medium text-slate-700">Tiện ích riêng của bất động sản<textarea name="custom_amenities" rows={2} className={textareaClass} placeholder="Mỗi dòng một tiện ích" /></label></div>
          <div hidden={amenityScope !== "unit"} role="tabpanel" className="space-y-4"><fieldset><legend className="mb-3 text-sm font-semibold text-slate-800">Tiện ích riêng trong căn/phòng</legend>{loadingCatalog ? <p className="text-sm text-slate-500">Đang tải tiện ích…</p> : unitAmenityEntries.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">Mọi tiện ích phù hợp đã được chọn cho toàn bất động sản.</p> : <div className="grid gap-2 sm:grid-cols-2">{unitAmenityEntries.map((amenity) => <label key={amenity.key} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"><span className="inline-flex items-center gap-2"><input type="checkbox" name={`unit_amenity:${amenity.key}`} className="size-4 accent-[#3368a0]" />{amenity.label}</span><input type="text" name={`unit_amenity_details:${amenity.key}`} maxLength={160} aria-label={`Ghi chú ${amenity.label}`} placeholder="Ghi chú tùy chọn" className={inputClass} /></label>)}</div>}</fieldset><label className="block text-sm font-medium text-slate-700">Tiện ích riêng mặc định cho các căn<textarea name="unit_custom_amenities" rows={2} className={textareaClass} placeholder="Mỗi dòng một tiện ích" /></label><p className="text-xs text-slate-500">Các tiện ích đã chọn sẽ được sao chép cho mọi căn/phòng.</p></div>
        </div>

        <div hidden={step !== 3} className="space-y-5">
          <div><h3 className="text-sm font-semibold text-slate-800">Quy định chung</h3><p className="mt-1 text-xs text-slate-500">Quy định thú cưng và hút thuốc được áp dụng cho mọi căn trừ khi thay đổi sau này.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Thú cưng<select name="pets" defaultValue="NOT_ALLOWED" className={selectClass} style={selectStyle}><option value="NOT_ALLOWED">Không cho phép</option><option value="WITH_APPROVAL">Cần phê duyệt</option><option value="ALLOWED">Được phép</option></select></label><label className="text-sm font-semibold text-slate-700">Hút thuốc<select name="smoking" defaultValue="NOT_ALLOWED" className={selectClass} style={selectStyle}><option value="NOT_ALLOWED">Không cho phép</option><option value="OUTDOOR_ONLY">Chỉ ngoài trời</option><option value="ALLOWED">Được phép</option></select></label></div>
          <label className="block text-sm font-semibold text-slate-700">Nội quy chung<textarea name="shared_rules" rows={3} className={textareaClass} placeholder="Mỗi dòng một nội quy dùng chung" /></label>
          {rentalArrangement === "SEPARATE_UNITS" && <section className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Nội quy riêng từng căn</h3><p className="mt-1 text-xs text-slate-500">Nội quy chung được kế thừa; chỉ nhập thêm điều khác biệt cho căn đang chọn.</p></div><span className="shrink-0 text-xs text-slate-500">{activeUnitIndex + 1} / {unitLabels.length}</span></div><div role="tablist" aria-label="Chọn căn để nhập nội quy riêng" className="mt-3 flex gap-2 overflow-x-auto pb-2">{unitLabels.map((label, index) => <button key={index} type="button" role="tab" aria-selected={activeUnitIndex === index} onClick={() => setActiveUnitIndex(index)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${activeUnitIndex === index ? "border-[#3368a0] bg-[#3368a0] text-white" : "border-slate-200 bg-white text-slate-700"}`}>{label.trim() || `Căn ${index + 1}`}</button>)}</div>{unitLabels.map((label, index) => <label key={index} hidden={activeUnitIndex !== index} className="mt-2 block text-sm font-medium text-slate-700">Nội quy bổ sung cho {label || `căn ${index + 1}`}<textarea name={`new_${index}_additional_rules`} rows={3} className={textareaClass} placeholder="Không nhập lại nội quy chung." /></label>)}</section>}
        </div>

        <div hidden={step !== 4} className="space-y-4">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-700"><span className="text-3xl text-[#3368a0]">↑</span><span className="mt-2 font-semibold">Kéo ảnh vào đây hoặc chọn tệp</span><span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP · tối đa 8 MB mỗi ảnh · tối đa 20 ảnh</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { const incoming = Array.from(event.currentTarget.files ?? []); const next = [...selectedPhotos]; for (const file of incoming) { if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file); } if (next.length > 20 || incoming.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) { setError("Chọn tối đa 20 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 8 MB."); } else { setSelectedPhotos(next); setError(""); setStatus(""); } event.currentTarget.value = ""; }} className="mt-4 max-w-full text-xs" /></label>
          {selectedPhotos.length > 0 && <ul className="space-y-2" aria-label="Ảnh đã chọn">{selectedPhotos.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><span className="min-w-0 truncate text-slate-700">{file.name} <span className="text-xs text-slate-500">({index < uploadedCount ? "Đã tải" : `${(file.size / 1024 / 1024).toFixed(1)} MB`})</span></span>{index >= uploadedCount && <button type="button" onClick={() => setSelectedPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 text-sm font-medium text-rose-700 hover:underline">Xóa</button>}</li>)}</ul>}
          <div className="rounded-lg bg-white p-4 text-sm text-slate-700"><strong>Kiểm tra trước khi lưu</strong><ul className="mt-2 list-disc space-y-1 pl-5"><li>Thông tin bất động sản và địa chỉ đã được nhập ở bước 1.</li><li>{rentalArrangement === "WHOLE_SPACE" ? "Một căn toàn bộ không gian sẽ được tạo tự động." : `${unitLabels.length} căn sẽ được tạo từ danh sách xem trước.`}</li><li>Giá và điều khoản mặc định đã được thiết lập ở bước 2.</li><li>Tiện ích và quy định được lưu theo đúng phạm vi.</li></ul></div>
        </div>
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}{createdProperty && <button type="button" onClick={() => router.push(`/owner/properties/${createdProperty.id}`)} className="ml-2 font-semibold underline">Mở bất động sản đã tạo</button>}</div>}
        {status && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{status}</p>}
        {Object.entries(fieldErrors).length > 0 && <ul role="alert" className="mt-3 list-disc rounded-xl border border-rose-200 bg-rose-50 px-8 py-3 text-sm text-rose-800">{Object.entries(fieldErrors).map(([field, messages]) => <li key={field}>{field}: {messages[0]}</li>)}</ul>}
        {uploadedCount > 0 && <p className="mt-3 text-sm text-slate-600" role="status">Đã tải {uploadedCount} ảnh.</p>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-6">
          <button type="button" onClick={() => router.push("/owner/properties")} className={secondaryButton}>Hủy</button>
          <div className="flex flex-wrap gap-3">
            <button type="button" aria-label="Quay lại bước trước" title="Quay lại bước trước" disabled={step === 0} onClick={() => { setError(""); setStep((current) => Math.max(current - 1, 0)); }} className={`${secondaryButton} size-11 px-0 text-xl disabled:opacity-40`}><span aria-hidden="true">←</span></button>
            {step < stages.length - 1 ? <button type="button" aria-label="Đến bước tiếp theo" title="Đến bước tiếp theo" onClick={(event) => { const form = event.currentTarget.form; if (form) goNext(form); }} className={`${primaryButton} size-11 px-0 text-xl`}><span aria-hidden="true">→</span></button> : setupComplete && createdProperty ? <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Đang tải ảnh…" : "Tiếp tục tải ảnh"}</button> : createdProperty ? <button type="button" onClick={() => router.push(`/owner/properties/${createdProperty.id}`)} className={primaryButton}>Mở bất động sản đã tạo</button> : <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Đang lưu…" : "Tạo bản nháp"}</button>}
          </div>
        </footer>
      </div>
    </form>
  </section>;
}
