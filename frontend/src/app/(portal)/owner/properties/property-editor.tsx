"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import {
  ApiError,
  archiveOwnerProperty,
  archiveOwnerUnit,
  getAmenityCatalog,
  getOwnerProperty,
  getOwnerPropertyMedia,
  removeOwnerMedia,
  saveOwnerUnitSharedMedia,
  updateOwnerGallery,
  updateOwnerProperty,
  updateOwnerUnitGallery,
  uploadOwnerMedia,
  type AmenityCatalogEntry,
  type AmenityDocument,
  type OwnerPropertyDetail,
  type OwnerPropertyMedia,
  type OwnerUnit,
} from "@/lib/auth-api";
import { VietnamLocationPicker } from "@/components/vietnam-location-picker";

const fieldClass =
  "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";

type WorkspaceTab = "overview" | "units" | "photos";

function fieldValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function optionalNumber(form: FormData, name: string): number | null {
  const value = fieldValue(form, name);
  return value === "" ? null : Number(value);
}

function combinedAmenityValue(
  shared?: AmenityDocument,
  unit?: AmenityDocument,
): AmenityDocument {
  return {
    schema_version: 1,
    standard: { ...(shared?.standard ?? {}), ...(unit?.standard ?? {}) },
    custom: [...(shared?.custom ?? []), ...(unit?.custom ?? [])].filter(
      (item, index, all) => all.indexOf(item) === index,
    ),
  };
}

function documentsFromCombinedForm(
  form: FormData,
  catalog: AmenityCatalogEntry[],
): { shared: AmenityDocument; unit: AmenityDocument } {
  const sharedStandard: AmenityDocument["standard"] = {};
  const unitStandard: AmenityDocument["standard"] = {};
  const custom = fieldValue(form, "custom_amenities")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const amenity of catalog) {
    if (form.get(`amenity:${amenity.key}`) !== "on") continue;
    const details = fieldValue(form, `amenity_details:${amenity.key}`);
    const entry = { enabled: true, ...(details ? { details } : {}) };
    if (amenity.scopes.includes("shared")) sharedStandard[amenity.key] = entry;
    if (amenity.scopes.includes("unit")) unitStandard[amenity.key] = entry;
  }
  return {
    shared: { schema_version: 1, standard: sharedStandard, custom },
    unit: { schema_version: 1, standard: unitStandard, custom },
  };
}


function AmenityFields({
  catalog,
  scope,
  scopes,
  value,
}: {
  catalog: AmenityCatalogEntry[];
  scope?: "shared" | "unit";
  scopes?: Array<"shared" | "unit">;
  value?: AmenityDocument;
}) {
  const accepted = new Set(scopes ?? (scope ? [scope] : []));
  const entries = catalog.filter((item) =>
    item.scopes.some((itemScope) => accepted.has(itemScope as "shared" | "unit")),
  );
  const selected = new Set(
    Object.entries(value?.standard ?? {})
      .filter(([, amenity]) => amenity.enabled)
      .map(([key]) => key),
  );
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-800">
        {scopes && scopes.length > 1
          ? "Tiện nghi"
          : `Tiện nghi ${scope === "unit" ? "trong phòng" : "dùng chung"}`}
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

function WholeSpaceFields({ property }: { property: OwnerPropertyDetail }) {
  const unit = property.units.find((item) => !item.archived_at);
  return (
    <>
      <label className="text-sm font-medium text-slate-700">
        Diện tích (m²)
        <input name="area_m2" type="number" min="0.1" step="0.01" defaultValue={unit?.area_m2 ?? ""} className={fieldClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Phòng ngủ
        <input name="bedrooms" type="number" min="0" required defaultValue={unit?.bedrooms ?? 0} className={fieldClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Phòng tắm
        <input name="bathrooms" type="number" min="0" step="1" required defaultValue={unit?.bathrooms ?? 1} className={fieldClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Giá thuê tháng (VND)
        <input name="advertised_monthly_rent" type="number" min="1" defaultValue={unit?.advertised_monthly_rent ?? ""} className={fieldClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Tiền đặt cọc (VND)
        <input name="deposit" type="number" min="0" defaultValue={unit?.deposit ?? ""} className={fieldClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Thời hạn thuê tối thiểu (tháng)
        <input name="minimum_rental_months" type="number" min="3" required defaultValue={unit?.minimum_rental_months ?? 3} className={fieldClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Số người tối đa
        <input name="max_occupants" type="number" min="1" defaultValue={unit?.max_occupants ?? ""} className={fieldClass} />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">
        Mô tả căn
        <textarea name="unit_description" rows={3} defaultValue={unit?.description ?? ""} className={fieldClass} />
      </label>
    </>
  );
}

function amenitiesFromForm(
  form: FormData,
  catalog: AmenityCatalogEntry[],
  scope: "shared" | "unit",
): AmenityDocument {
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) => item.scopes.includes(scope))) {
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

export function PropertyEditor({
  propertyId,
  tab,
}: {
  propertyId: string;
  tab: WorkspaceTab;
}) {
  const router = useRouter();
  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [media, setMedia] = useState<OwnerPropertyMedia[]>([]);
  const [catalog, setCatalog] = useState<AmenityCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const loadProperty = useCallback(async () => {
    const [detail, photos] = await Promise.all([
      getOwnerProperty(propertyId),
      getOwnerPropertyMedia(propertyId),
    ]);
    setProperty(detail);
    setMedia(photos);
    return detail;
  }, [propertyId]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [detail, photos, amenities] = await Promise.all([
          getOwnerProperty(propertyId),
          getOwnerPropertyMedia(propertyId),
          getAmenityCatalog(),
        ]);
        if (!active) return;
        setProperty(detail);
        setMedia(photos);
        setCatalog(amenities);
      } catch (caught) {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Không thể tải bất động sản.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  function reportError(caught: unknown) {
    if (caught instanceof ApiError) {
      setError(caught.message);
      setFieldErrors(caught.errors);
      if (caught.status === 401) router.replace("/login");
    } else {
      setError("Không thể lưu thay đổi. Vui lòng thử lại.");
    }
  }

  function openTab(next: WorkspaceTab) {
    router.push(
      next === "overview"
        ? `/owner/properties/${propertyId}`
        : `/owner/properties/${propertyId}?tab=${next}`,
    );
  }

  async function saveProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    try {
      const wholeSpace = property.rental_arrangement === "WHOLE_SPACE";
      const amenities = wholeSpace
        ? documentsFromCombinedForm(form, catalog)
        : { shared: amenitiesFromForm(form, catalog, "shared"), unit: null };
      const updated = await updateOwnerProperty(property.id, {
        name: fieldValue(form, "name"),
        property_type: fieldValue(form, "property_type"),
        rental_arrangement: property.rental_arrangement,
        address_line: fieldValue(form, "address_line") || null,
        ward: fieldValue(form, "ward") || null,
        city: fieldValue(form, "city") || null,
        description: fieldValue(form, "description") || null,
        shared_amenities: amenities.shared,
        ...(wholeSpace
          ? {
              unit_amenities: amenities.unit,
              unit_description: fieldValue(form, "unit_description") || null,
              area_m2: optionalNumber(form, "area_m2"),
              bedrooms: optionalNumber(form, "bedrooms") ?? 0,
              bathrooms: optionalNumber(form, "bathrooms") ?? 0,
              advertised_monthly_rent: optionalNumber(form, "advertised_monthly_rent"),
              deposit: optionalNumber(form, "deposit"),
              minimum_rental_months: optionalNumber(form, "minimum_rental_months") ?? 3,
              max_occupants: optionalNumber(form, "max_occupants"),
            }
          : {}),
        policies: {
          schema_version: 1,
          pets: fieldValue(form, "pets"),
          smoking: fieldValue(form, "smoking"),
          shared_rules: fieldValue(form, "shared_rules")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        expected_content_revision: property.content_revision,
      });
      setProperty(updated);
      setNotice("Thông tin bất động sản đã được lưu.");
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function archiveProperty() {
    if (
      !property ||
      !window.confirm(
        "Lưu trữ bất động sản này? Lịch sử phòng và tin đăng vẫn được giữ.",
      )
    )
      return;
    setBusy(true);
    try {
      await archiveOwnerProperty(property.id, property.content_revision);
      router.push("/owner/properties");
    } catch (caught) {
      reportError(caught);
      setBusy(false);
    }
  }

  async function archiveUnit(unit: OwnerUnit) {
    if (!property || !window.confirm(`Lưu trữ ${unit.label}?`)) return;
    setBusy(true);
    try {
      await archiveOwnerUnit(property.id, unit.id, property.content_revision);
      await loadProperty();
      setNotice("Phòng đã được lưu trữ.");
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  const units = property?.units.filter((unit) => !unit.archived_at) ?? [];
  const policy = property?.policies;
  const separate = property?.rental_arrangement === "SEPARATE_UNITS";
  const activeTab: WorkspaceTab =
    property?.rental_arrangement === "WHOLE_SPACE" && tab === "units" ? "overview" : tab;

  return (
    <section className="mx-auto w-full max-w-6xl px-1 py-4 sm:px-2 sm:py-6">
      <Link
        href="/owner/properties"
        className="mb-2 inline-flex text-sm font-semibold text-[#3368a0] hover:underline"
      >
        ← Danh sách bất động sản
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {property?.name ?? "Bất động sản"}
      </h1>
      {loading && (
        <div
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
          aria-busy="true"
        >
          Đang tải bất động sản…
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
      {notice && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
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
      {property && (
        <nav
          aria-label="Quản lý bất động sản"
          className="mb-5 mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3"
        >
          {(
            [
              ["overview", "Thông tin"],
              ["units", "Danh sách căn"],
              ["photos", "Hình ảnh"],
            ] as const
          )
            .filter(([value]) => property.rental_arrangement !== "WHOLE_SPACE" || value !== "units")
            .map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => openTab(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === value ? "bg-[#3368a0] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {property && activeTab === "overview" && (
        <form
          key={property.id}
          onSubmit={saveProperty}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Thông tin bất động sản
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Phiên bản nội dung {property.content_revision}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void archiveProperty()}
              disabled={busy}
              className="text-sm font-semibold text-rose-700 hover:underline"
            >
              Lưu trữ
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Tên bất động sản
              <input
                name="name"
                required
                maxLength={255}
                defaultValue={property.name}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Loại bất động sản
              <select
                name="property_type"
                defaultValue={property.property_type}
                className={fieldClass}
              >
                <option value="APARTMENT">Căn hộ</option>
                <option value="APARTMENT_BUILDING">Tòa căn hộ</option>
                <option value="HOUSE">Nhà</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Cách cho thuê
              <select
                name="rental_arrangement"
                defaultValue={property.rental_arrangement}
                disabled
                className={fieldClass}
              >
                <option value="WHOLE_SPACE">
                  Cho thuê nguyên căn / nguyên căn hộ
                </option>
                <option value="SEPARATE_UNITS">Cho thuê từng phòng</option>
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                Cách cho thuê đã cố định khi tạo bất động sản.
              </span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Địa chỉ
              <input
                name="address_line"
                maxLength={500}
                defaultValue={property.address_line ?? ""}
                className={fieldClass}
              />
            </label>
            <div className="md:col-span-2">
              <VietnamLocationPicker
                initialCity={property.city ?? ""}
                initialWard={property.ward ?? ""}
                required={false}
              />
            </div>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Mô tả bất động sản
              <textarea
                name="description"
                rows={4}
                maxLength={10000}
                defaultValue={property.description ?? ""}
                className={fieldClass}
              />
            </label>
            {property.rental_arrangement === "WHOLE_SPACE" && (
              <WholeSpaceFields property={property} />
            )}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <AmenityFields
              key={`shared-${property.content_revision}`}
              catalog={catalog}
              scope={property.rental_arrangement === "WHOLE_SPACE" ? undefined : "shared"}
              scopes={property.rental_arrangement === "WHOLE_SPACE" ? ["shared", "unit"] : undefined}
              value={
                property.rental_arrangement === "WHOLE_SPACE"
                  ? combinedAmenityValue(
                      property.shared_amenities,
                      property.units.find((unit) => !unit.archived_at)?.amenities,
                    )
                  : property.shared_amenities
              }
            />
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-slate-800">
                Quy định dùng chung
              </legend>
              <label className="block text-xs font-medium text-slate-600">
                Thú cưng
                <select
                  name="pets"
                  defaultValue={policy?.pets ?? "NOT_ALLOWED"}
                  className={fieldClass}
                >
                  <option value="NOT_ALLOWED">Không cho phép</option>
                  <option value="WITH_APPROVAL">Cần phê duyệt</option>
                  <option value="ALLOWED">Được phép</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Hút thuốc
                <select
                  name="smoking"
                  defaultValue={policy?.smoking ?? "NOT_ALLOWED"}
                  className={fieldClass}
                >
                  <option value="NOT_ALLOWED">Không cho phép</option>
                  <option value="OUTDOOR_ONLY">Chỉ khu vực ngoài trời</option>
                  <option value="ALLOWED">Được phép</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Quy định khác, mỗi dòng một mục
                <textarea
                  name="shared_rules"
                  rows={3}
                  defaultValue={policy?.shared_rules.join("\n") ?? ""}
                  className={fieldClass}
                />
              </label>
            </fieldset>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? "Đang lưu…" : "Lưu thông tin"}
            </button>
          </div>
        </form>
      )}

      {property && activeTab === "units" && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Danh sách căn
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Việc chọn căn đưa lên tin đăng nằm ở trang tin đăng.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {units.length} căn
                </span>
                {separate && (
                  <Link
                    href={`/owner/properties/${property.id}/units/new`}
                    className={buttonClass}
                  >
                    Thêm phòng
                  </Link>
                )}
              </div>
            </div>
            {units.length === 0 ? (
              <p className="m-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Chưa có căn.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Căn</th>
                      <th className="px-4 py-3">Loại · diện tích</th>
                      <th className="px-4 py-3">Giá thuê</th>
                      <th className="px-4 py-3">Tiền cọc</th>
                      <th className="px-4 py-3">Vận hành</th>
                      <th className="px-4 py-3">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {units.map((unit) => (
                      <tr key={unit.id}>
                        <td className="px-4 py-3 font-semibold text-[#3368a0]">
                          {unit.label}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {unit.unit_kind}
                          {unit.area_m2 ? ` · ${unit.area_m2} m²` : ""}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {unit.advertised_monthly_rent
                            ? `${Number(unit.advertised_monthly_rent).toLocaleString("vi-VN")} ₫`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {unit.deposit
                            ? `${Number(unit.deposit).toLocaleString("vi-VN")} ₫`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${unit.operational_status === "READY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                          >
                            {unit.operational_status === "READY"
                              ? "Sẵn sàng"
                              : unit.operational_status === "MAINTENANCE"
                                ? "Bảo trì"
                                : "Ngừng"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/owner/properties/${property.id}/units/${unit.id}`}
                            className="font-semibold text-[#3368a0] hover:underline"
                          >
                            Sửa
                          </Link>
                          {separate && (
                            <button
                              type="button"
                              onClick={() => void archiveUnit(unit)}
                              disabled={busy}
                              className="ml-3 font-semibold text-rose-700 hover:underline"
                            >
                              Lưu trữ
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {property && activeTab === "photos" && (
        <PropertyPhotos
          property={property}
          media={media}
          busy={busy}
          setBusy={setBusy}
          onReload={loadProperty}
          onError={reportError}
          onNotice={setNotice}
        />
      )}
    </section>
  );
}

function PropertyPhotos({
  property,
  media,
  busy,
  setBusy,
  onReload,
  onError,
}: {
  property: OwnerPropertyDetail;
  media: OwnerPropertyMedia[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  onReload: () => Promise<OwnerPropertyDetail>;
  onError: (caught: unknown) => void;
  onNotice: (value: string | null) => void;
}) {
  const searchParams = useSearchParams();
  const units = property.units.filter((unit) => !unit.archived_at);
  const separate =
    property.rental_arrangement === "SEPARATE_UNITS" && units.length > 0;
  
  // Read initial scope and unitId from URL parameters
  const initialScope = searchParams.get("photoScope") as "property" | "unit" | null;
  const initialUnitId = searchParams.get("unitId");
  
  const [scope, setScope] = useState<"property" | "unit">(
    separate && initialScope === "unit" ? "unit" : "property",
  );
  const [activeUnitId, setActiveUnitId] = useState(
    initialUnitId && units.some(u => u.id === initialUnitId)
      ? initialUnitId
      : units[0]?.id ?? ""
  );
  const [pending, setPending] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [listingFlags, setListingFlags] = useState<Record<string, boolean>>({});

  // Create blob URLs from pending files (computed during render, not in effect)
  const pendingUrls = useMemo(() => {
    return pending.map((file) => URL.createObjectURL(file));
  }, [pending]);

  // Update URL parameters when scope or activeUnitId changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "photos");
    params.set("photoScope", scope);
    if (scope === "unit" && activeUnitId) {
      params.set("unitId", activeUnitId);
    } else {
      params.delete("unitId");
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    if (window.location.search !== `?${params.toString()}`) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [scope, activeUnitId]);

  // Clean up blob URLs when they change or component unmounts
  useEffect(() => {
    return () => {
      pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingUrls]);
  function listed(item: OwnerPropertyMedia) {
    return listingFlags[item.id] ?? item.is_selected_for_listing;
  }
  const shared = useMemo(
    () =>
      media
        .filter((item) => item.unit_id === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [media],
  );
  const [selectedByUnit, setSelectedByUnit] = useState<
    Record<string, string[]>
  >(() =>
    Object.fromEntries(
      units.map((unit) => [
        unit.id,
        shared
          .filter((item) => (item.assigned_unit_ids ?? []).includes(unit.id))
          .map((item) => item.id),
      ]),
    ),
  );
  const visible =
    scope === "property"
      ? shared
      : media
          .filter((item) => item.unit_id === activeUnitId)
          .sort((a, b) => a.sort_order - b.sort_order);
  const selected = new Set(selectedByUnit[activeUnitId] ?? []);
  const saved = shared
    .filter((item) => (item.assigned_unit_ids ?? []).includes(activeUnitId))
    .map((item) => item.id);
  const selectionChanged =
    (selectedByUnit[activeUnitId] ?? []).length !== saved.length ||
    (selectedByUnit[activeUnitId] ?? []).some((id) => !saved.includes(id));

  function addPendingFiles(files: File[]) {
    const images = files.filter((file) =>
      /^(image\/jpeg|image\/png|image\/webp)$/.test(file.type),
    );
    if (images.length < files.length) {
      toast.error("Chỉ nhận ảnh JPG, PNG hoặc WEBP.");
    }
    if (images.length === 0) return;
    setPending((current) => {
      const next = [...current];
      for (const file of images) {
        const alreadyQueued = next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        );
        if (!alreadyQueued) next.push(file);
      }
      return next;
    });
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.length === 0) return;
    if (
      pending.some(
        (file) =>
          !/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) ||
          file.size > 8 * 1024 * 1024,
      ) ||
      media.length + pending.length > 20
    ) {
      toast.error("Chọn ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 8 MB; tổng tối đa 20 ảnh.");
      return;
    }
    setBusy(true);
    try {
      let current = property;
      for (const file of pending) {
        const uploaded = await uploadOwnerMedia(current.id, {
          file,
          client_operation_id: crypto.randomUUID(),
          expected_content_revision: current.content_revision,
          unit_id: scope === "unit" ? activeUnitId : undefined,
        });
        current = { ...current, content_revision: uploaded.content_revision };
      }
      setPending([]);
      await onReload();
      toast.success("Ảnh đã được tải lên.");
    } catch (caught) {
      onError(caught);
      toast.error("Không thể tải ảnh lên. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function saveShared() {
    setBusy(true);
    try {
      await saveOwnerUnitSharedMedia(property.id, activeUnitId, {
        expected_content_revision: property.content_revision,
        media_ids: selectedByUnit[activeUnitId] ?? [],
      });
      await onReload();
      toast.success("Đã lưu lựa chọn ảnh dùng chung.");
    } catch (caught) {
      onError(caught);
      toast.error("Không thể lưu lựa chọn. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function saveVisibleSelection(items: OwnerPropertyMedia[]) {
    setBusy(true);
    try {
      const payload = {
        expected_content_revision: property.content_revision,
        items: items.map((item, index) => ({
          media_id: item.id,
          revision: item.revision,
          sort_order: index,
          is_selected_for_listing: listed(item),
        })),
      };
      if (scope === "property") await updateOwnerGallery(property.id, payload);
      else await updateOwnerUnitGallery(property.id, activeUnitId, payload);
      await onReload();
      toast.success("Thứ tự và lựa chọn hiển thị đã được lưu.");
    } catch (caught) {
      onError(caught);
      toast.error("Không thể lưu thay đổi. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: OwnerPropertyMedia) {
    if (
      !window.confirm("Gỡ ảnh khỏi thư viện? Tệp được lưu giữ trong lịch sử.")
    )
      return;
    setBusy(true);
    try {
      await removeOwnerMedia(
        property.id,
        photo.id,
        property.content_revision,
        photo.revision,
      );
      await onReload();
      toast.success("Ảnh đã được gỡ khỏi thư viện.");
    } catch (caught) {
      onError(caught);
      toast.error("Không thể gỡ ảnh. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Quản lý ảnh
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {separate
                ? "Ảnh dùng chung chỉ lưu một bản. Bạn có thể thêm ảnh đó vào nhiều căn/phòng."
                : "Ảnh bất động sản được dùng trực tiếp cho tin đăng."}
            </p>
          </div>
          {separate && (
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={scope === "property"}
                onClick={() => setScope("property")}
                className={`min-h-10 rounded-lg border px-4 text-sm font-semibold ${scope === "property" ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 text-slate-700"}`}
              >
                Ảnh bất động sản
              </button>
              <button
                type="button"
                aria-pressed={scope === "unit"}
                onClick={() => setScope("unit")}
                className={`min-h-10 rounded-lg border px-4 text-sm font-semibold ${scope === "unit" ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 text-slate-700"}`}
              >
                Ảnh căn/phòng
              </button>
            </div>
          )}
        </div>
        {scope === "unit" && (
          <label className="mt-4 block max-w-md text-sm font-medium text-slate-700">
            Chọn căn/phòng
            <select
              value={activeUnitId}
              onChange={(event) => setActiveUnitId(event.target.value)}
              className={fieldClass}
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <form onSubmit={upload} className="mt-4 space-y-4">
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setDragOver(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (busy) return;
              addPendingFiles(Array.from(event.dataTransfer.files));
            }}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4 ${dragOver ? "border-[#3368a0] bg-blue-50" : "border-slate-300 bg-slate-50"}`}
          >
            <div>
              <p className="text-sm font-medium text-slate-800">
                Kéo thả ảnh vào đây, hoặc chọn thêm ảnh
              </p>
              <p className="mt-1 text-sm text-slate-600">
                JPG, PNG, WEBP · tối đa 8 MB mỗi ảnh · tối đa 20 ảnh
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={`${buttonClass} cursor-pointer`}>
                {scope === "unit" ? "Chọn ảnh" : "Tải ảnh dùng chung lên"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    addPendingFiles(Array.from(event.currentTarget.files ?? []));
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {pending.length > 0 && (
                <button
                  type="submit"
                  disabled={busy}
                  className={buttonClass}
                >
                  {busy ? "Đang tải…" : `Tải ${pending.length} ảnh`}
                </button>
              )}
            </div>
          </div>
          
          {pending.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Ảnh đã chọn ({pending.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setPending([])}
                  disabled={busy}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                >
                  Xóa tất cả
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pending.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="relative aspect-[4/3] bg-slate-100">
                        {pendingUrls[index] && (
                          <Image
                            src={pendingUrls[index]}
                            alt={file.name}
                            fill
                            unoptimized
                            sizes="25vw"
                            className="object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setPending((current) =>
                              current.filter((_, i) => i !== index)
                            )
                          }
                          disabled={busy}
                          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-rose-600 text-white opacity-0 shadow-lg transition-opacity hover:bg-rose-700 group-hover:opacity-100 disabled:opacity-50"
                          aria-label="Xóa ảnh"
                        >
                          ×
                        </button>
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="truncate text-xs font-medium text-slate-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </form>
      </section>

      {scope === "unit" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Ảnh dùng chung từ bất động sản
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Chọn ảnh sẽ xuất hiện trong thư viện của căn này. Ảnh được dùng
                lại trực tiếp, không tải lên bản sao.
              </p>
            </div>
            {shared.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setSelectedByUnit((current) => ({
                      ...current,
                      [activeUnitId]:
                        selected.size === shared.length
                          ? []
                          : shared.map((item) => item.id),
                    }))
                  }
                  className={secondaryButtonClass}
                >
                  {selected.size === shared.length
                    ? "Bỏ chọn tất cả"
                    : "Chọn tất cả"}
                </button>
                <button
                  type="button"
                  disabled={busy || !selectionChanged}
                  onClick={() => void saveShared()}
                  className={buttonClass}
                >
                  Lưu lựa chọn
                </button>
              </div>
            )}
          </div>
          {shared.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              Chưa có ảnh dùng chung.
            </p>
          ) : (
            <div className="mt-4 max-h-[28rem] overflow-y-auto">
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {shared.map((item) => (
                  <li
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      {item.preview_url ? (
                        <Image
                          src={item.preview_url}
                          alt={item.caption || "Ảnh dùng chung"}
                          fill
                          unoptimized
                          sizes="25vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                          Ảnh
                        </div>
                      )}
                      <label className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-md bg-white/95">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() =>
                            setSelectedByUnit((current) => {
                              const next = new Set(current[activeUnitId] ?? []);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return { ...current, [activeUnitId]: [...next] };
                            })
                          }
                          className="size-4 accent-[#3368a0]"
                          aria-label="Chọn ảnh dùng chung"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3 text-sm">
                      <span className="truncate">
                        {item.caption || "Ảnh dùng chung"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${selected.has(item.id) ? "bg-blue-50 text-[#285584]" : "bg-slate-100 text-slate-500"}`}
                      >
                        {selected.has(item.id) ? "Đã chọn" : "Chưa chọn"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {scope === "property"
              ? "Thư viện ảnh bất động sản"
              : "Ảnh riêng của căn"}
          </h2>
          <button
            type="button"
            disabled={busy || visible.length === 0}
            onClick={() => void saveVisibleSelection(visible)}
            className={secondaryButtonClass}
          >
            Lưu lựa chọn hiển thị
          </button>
        </div>
        {visible.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Chưa có ảnh trong mục này.
          </p>
        ) : (
          <div className="mt-4 max-h-[28rem] overflow-y-auto">
            <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item, index) => (
                <li
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {item.preview_url ? (
                      <Image
                        src={item.preview_url}
                        alt={item.caption || `Ảnh ${index + 1}`}
                        fill
                        unoptimized
                        sizes="33vw"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="truncate text-sm font-semibold">
                      {item.caption || `Ảnh ${index + 1}`}
                    </p>
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={listed(item)}
                        onChange={(event) =>
                          setListingFlags((current) => ({
                            ...current,
                            [item.id]: event.target.checked,
                          }))
                        }
                        className="size-4 accent-[#3368a0]"
                      />
                      Hiển thị trên tin
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        onClick={() => {
                          const next = [...visible];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          void saveVisibleSelection(next);
                        }}
                        className="size-8 rounded-lg border"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === visible.length - 1}
                        onClick={() => {
                          const next = [...visible];
                          [next[index + 1], next[index]] = [
                            next[index],
                            next[index + 1],
                          ];
                          void saveVisibleSelection(next);
                        }}
                        className="size-8 rounded-lg border"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(item)}
                        className="size-8 rounded-lg text-rose-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
