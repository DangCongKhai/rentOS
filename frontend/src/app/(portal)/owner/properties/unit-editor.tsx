"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  getAmenityCatalog,
  getOwnerProperty,
  updateOwnerUnit,
  type AmenityCatalogEntry,
  type AmenityDocument,
  type OwnerUnit,
} from "@/lib/auth-api";

const fieldClass =
  "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";

function fieldValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function numberValue(form: FormData, name: string): number | null {
  const value = fieldValue(form, name);
  return value === "" ? null : Number(value);
}

function AmenityFields({
  catalog,
  value,
}: {
  catalog: AmenityCatalogEntry[];
  value?: AmenityDocument;
}) {
  const entries = catalog.filter((item) => item.scopes.includes("unit"));
  const selected = new Set(
    Object.entries(value?.standard ?? {})
      .filter(([, amenity]) => amenity.enabled)
      .map(([key]) => key),
  );
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-800">
        Tiện nghi trong phòng
      </legend>
      <div className="flex flex-wrap gap-2">
        {entries.map((item) => (
          <label
            key={item.key}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              name={`amenity:${item.key}`}
              defaultChecked={selected.has(item.key)}
              className="size-4 accent-[#3368a0]"
            />
            {item.label}
            <input
              type="text"
              name={`amenity_details:${item.key}`}
              defaultValue={value?.standard[item.key]?.details ?? ""}
              maxLength={160}
              aria-label={`Ghi chú ${item.label}`}
              placeholder="Ghi chú tùy chọn"
              className="ml-2 w-40 rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
          </label>
        ))}
      </div>
      <label className="block text-xs font-medium text-slate-600">
        Tiện nghi riêng, mỗi dòng một mục
        <textarea
          name="custom_amenities"
          defaultValue={value?.custom.join("\n") ?? ""}
          rows={2}
          className={fieldClass}
          placeholder="Ví dụ: Ban công hướng biển"
        />
      </label>
    </fieldset>
  );
}

function amenitiesFromForm(
  form: FormData,
  catalog: AmenityCatalogEntry[],
): AmenityDocument {
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) =>
    item.scopes.includes("unit"),
  )) {
    if (form.get(`amenity:${amenity.key}`) === "on") {
      const details = fieldValue(form, `amenity_details:${amenity.key}`);
      standard[amenity.key] = {
        enabled: true,
        ...(details ? { details } : {}),
      };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: fieldValue(form, "custom_amenities")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function UnitEditor({
  propertyId,
  unitId,
}: {
  propertyId: string;
  unitId: string;
}) {
  const router = useRouter();
  const [unit, setUnit] = useState<OwnerUnit | null>(null);
  const [revision, setRevision] = useState(1);
  const [catalog, setCatalog] = useState<AmenityCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const listHref = `/owner/properties/${propertyId}?tab=units`;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [property, amenities] = await Promise.all([
          getOwnerProperty(propertyId),
          getAmenityCatalog(),
        ]);
        if (!active) return;
        const match =
          property.units.find(
            (item) => item.id === unitId && !item.archived_at,
          ) ?? null;
        setUnit(match);
        setRevision(property.content_revision);
        setCatalog(amenities);
        if (!match) setError("Không tìm thấy phòng.");
      } catch (caught) {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(
          caught instanceof ApiError ? caught.message : "Không thể tải phòng.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [propertyId, unitId, router]);

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unit) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await updateOwnerUnit(propertyId, unit.id, {
        expected_content_revision: revision,
        label: fieldValue(form, "label"),
        unit_kind: fieldValue(form, "unit_kind"),
        description: fieldValue(form, "description") || null,
        floor: fieldValue(form, "floor") || null,
        area_m2: numberValue(form, "area_m2"),
        bedrooms: numberValue(form, "bedrooms") ?? 0,
        bathrooms: numberValue(form, "bathrooms") ?? 0,
        advertised_monthly_rent: numberValue(form, "advertised_monthly_rent"),
        deposit: numberValue(form, "deposit"),
        minimum_rental_months: numberValue(form, "minimum_rental_months") ?? 3,
        max_occupants: numberValue(form, "max_occupants") ?? 1,
        operational_status:
          fieldValue(form, "operational_status") || unit.operational_status,
        amenities: amenitiesFromForm(form, catalog),
        policy_overrides: {
          ...(fieldValue(form, "pets_override")
            ? { pets: fieldValue(form, "pets_override") }
            : {}),
          ...(fieldValue(form, "smoking_override")
            ? { smoking: fieldValue(form, "smoking_override") }
            : {}),
          additional_rules: fieldValue(form, "additional_rules")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });
      router.push(listHref);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors);
        if (caught.status === 401) router.replace("/login");
      } else {
        setError("Không thể lưu thay đổi. Vui lòng thử lại.");
      }
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-1 py-4 sm:px-2 sm:py-6">
      <Link
        href={listHref}
        className="mb-2 inline-flex text-sm font-semibold text-[#3368a0] hover:underline"
      >
        ← Danh sách căn
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {unit ? `Sửa ${unit.label}` : "Phòng"}
      </h1>
      {loading && (
        <div
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
          aria-busy="true"
        >
          Đang tải phòng…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      )}
      {Object.entries(fieldErrors).length > 0 && (
        <ul
          role="alert"
          className="mt-4 list-disc rounded-xl border border-rose-200 bg-rose-50 px-8 py-3 text-sm text-rose-800"
        >
          {Object.entries(fieldErrors).map(([field, messages]) => (
            <li key={field}>{messages[0]}</li>
          ))}
        </ul>
      )}
      {unit && (
        <form
          key={unit.id}
          onSubmit={saveUnit}
          className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6"
        >
          <label className="text-sm font-medium text-slate-700">
            Tên phòng
            <input
              name="label"
              required
              maxLength={120}
              defaultValue={unit.label}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Loại phòng
            <select
              name="unit_kind"
              defaultValue={unit.unit_kind}
              className={fieldClass}
            >
              <option value="ROOM">Phòng</option>
              <option value="STUDIO">Studio</option>
              <option value="APARTMENT">Căn hộ</option>
              <option value="HOUSE">Nhà</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Diện tích (m²)
            <input
              name="area_m2"
              type="number"
              min="0.1"
              step="0.01"
              defaultValue={unit.area_m2 ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tầng
            <input
              name="floor"
              defaultValue={unit.floor ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Phòng ngủ
            <input
              name="bedrooms"
              type="number"
              min="0"
              required
              defaultValue={unit.bedrooms ?? 0}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Phòng tắm
            <input
              name="bathrooms"
              type="number"
              min="0"
              step="0.5"
              required
              defaultValue={unit.bathrooms ?? 1}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Thời hạn thuê tối thiểu (tháng)
            <input
              name="minimum_rental_months"
              type="number"
              min="3"
              required
              defaultValue={unit.minimum_rental_months ?? 3}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Giá thuê tháng (VND)
            <input
              name="advertised_monthly_rent"
              type="number"
              min="1"
              defaultValue={unit.advertised_monthly_rent ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tiền đặt cọc (VND)
            <input
              name="deposit"
              type="number"
              min="0"
              defaultValue={unit.deposit ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Số người tối đa
            <input
              name="max_occupants"
              type="number"
              min="1"
              defaultValue={unit.max_occupants ?? 1}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Trạng thái
            <select
              name="operational_status"
              defaultValue={unit.operational_status}
              className={fieldClass}
            >
              <option value="READY">Sẵn sàng</option>
              <option value="MAINTENANCE">Bảo trì</option>
              <option value="RETIRED">Ngừng khai thác</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Mô tả phòng
            <textarea
              name="description"
              rows={3}
              defaultValue={unit.description ?? ""}
              className={fieldClass}
            />
          </label>
          <div className="sm:col-span-2">
            <AmenityFields
              key={unit.id}
              catalog={catalog}
              value={unit.amenities}
            />
          </div>
          <label className="text-sm font-medium text-slate-700">
            Thú cưng
            <select
              name="pets_override"
              defaultValue={unit.policy_overrides.pets ?? ""}
              className={fieldClass}
            >
              <option value="">Theo quy định chung</option>
              <option value="NOT_ALLOWED">Không cho phép</option>
              <option value="WITH_APPROVAL">Cần phê duyệt</option>
              <option value="ALLOWED">Được phép</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Hút thuốc
            <select
              name="smoking_override"
              defaultValue={unit.policy_overrides.smoking ?? ""}
              className={fieldClass}
            >
              <option value="">Theo quy định chung</option>
              <option value="NOT_ALLOWED">Không cho phép</option>
              <option value="OUTDOOR_ONLY">Chỉ ngoài trời</option>
              <option value="ALLOWED">Được phép</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Quy định riêng, mỗi dòng một mục
            <textarea
              name="additional_rules"
              rows={2}
              defaultValue={
                unit.policy_overrides.additional_rules?.join("\n") ?? ""
              }
              className={fieldClass}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? "Đang lưu…" : "Lưu phòng"}
            </button>
            <Link href={listHref} className={secondaryButtonClass}>
              Hủy sửa
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
