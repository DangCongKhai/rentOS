"use client";

import type { AmenityCatalogEntry } from "@/lib/auth-api";
import { CheckboxGroup } from "./shared/checkbox-group";
import { textareaClass } from "./shared/form-styles";

type AmenitiesStepProps = {
  catalog: AmenityCatalogEntry[];
  loadingCatalog: boolean;
  sharedAmenityKeys: Set<string>;
  onSharedAmenityKeysChange: (keys: Set<string>) => void;
  amenityScope: "property" | "unit";
  onAmenityScopeChange: (scope: "property" | "unit") => void;
};

export function AmenitiesStep({
  catalog,
  loadingCatalog,
  sharedAmenityKeys,
  onSharedAmenityKeysChange,
  amenityScope,
  onAmenityScopeChange,
}: AmenitiesStepProps) {
  const amenityEntries = catalog.filter((item) =>
    item.scopes.includes("shared")
  );
  const unitAmenityEntries = catalog.filter(
    (item) => item.scopes.includes("unit") && !sharedAmenityKeys.has(item.key)
  );

  function handleSharedAmenityChange(key: string, checked: boolean) {
    const next = new Set(sharedAmenityKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onSharedAmenityKeysChange(next);
  }

  return ( 
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Tiện ích của bất động sản và căn/phòng
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Chọn phạm vi bên dưới. Tiện ích ở bất động sản sẽ không lặp lại
            trong căn.
          </p>
        </div>
      </div>
      <div
        role="tablist"
        aria-label="Phạm vi tiện ích"
        className="flex gap-2 border-b border-slate-200 pb-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={amenityScope === "property"}
          onClick={() => onAmenityScopeChange("property")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${amenityScope === "property" ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 bg-white text-slate-600"}`}
        >
          Toàn bất động sản
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={amenityScope === "unit"}
          onClick={() => onAmenityScopeChange("unit")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${amenityScope === "unit" ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 bg-white text-slate-600"}`}
        >
          Trong căn/phòng
        </button>
      </div>
      <div
        hidden={amenityScope !== "property"}
        role="tabpanel"
        className="space-y-4"
      >
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-800">
            Tiện ích dùng chung
          </legend>
          {loadingCatalog ? (
            <p className="text-sm text-slate-500">Đang tải tiện ích…</p>
          ) : (
            <CheckboxGroup
              items={amenityEntries.map((amenity) => ({
                key: amenity.key,
                label: amenity.label,
                checked: sharedAmenityKeys.has(amenity.key),
              }))}
              namePrefix="amenity:"
              detailsNamePrefix="amenity_details:"
              onChange={handleSharedAmenityChange}
            />
          )}
        </fieldset>
        <label className="block text-sm font-medium text-slate-700">
          Tiện ích riêng của bất động sản
          <textarea
            name="custom_amenities"
            rows={2}
            className={textareaClass}
            placeholder="Mỗi dòng một tiện ích"
          />
        </label>
      </div>
      <div
        hidden={amenityScope !== "unit"}
        role="tabpanel"
        className="space-y-4"
      >
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-800">
            Tiện ích riêng trong căn/phòng
          </legend>
          {loadingCatalog ? (
            <p className="text-sm text-slate-500">Đang tải tiện ích…</p>
          ) : unitAmenityEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              Mọi tiện ích phù hợp đã được chọn cho toàn bất động sản.
            </p>
          ) : (
            <CheckboxGroup
              items={unitAmenityEntries.map((amenity) => ({
                key: amenity.key,
                label: amenity.label,
                checked: false,
              }))}
              namePrefix="unit_amenity:"
              detailsNamePrefix="unit_amenity_details:"
              onChange={() => {}}
            />
          )}
        </fieldset>
        <label className="block text-sm font-medium text-slate-700">
          Tiện ích riêng mặc định cho các căn
          <textarea
            name="unit_custom_amenities"
            rows={2}
            className={textareaClass}
            placeholder="Mỗi dòng một tiện ích"
          />
        </label>
        <p className="text-xs text-slate-500">
          Các tiện ích đã chọn sẽ được sao chép cho mọi căn/phòng.
        </p>
      </div>
    </div>
  );
}
