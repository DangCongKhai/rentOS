"use client";

import type { AmenityCatalogEntry } from "@/lib/auth-api";
import type { RoomDraft } from "./shared/types";

export type ReviewStepFormData = {
  name: string;
  propertyType: string;
  description: string;
  city: string;
  ward: string;
  addressLine: string;
  pets: string;
  smoking: string;
  sharedRules: string;
  rent: string;
  area_m2: string;
  custom_amenities: string;
};

type ReviewStepProps = {
  formData: ReviewStepFormData;
  rentalArrangement: "WHOLE_SPACE" | "SEPARATE_UNITS";
  rooms: RoomDraft[];
  sharedAmenityKeys: Set<string>;
  catalog: AmenityCatalogEntry[];
  onNavigateToStep: (step: number) => void;
};

export function ReviewStep({
  formData,
  rentalArrangement,
  rooms,
  sharedAmenityKeys,
  catalog,
  onNavigateToStep,
}: ReviewStepProps) {
  const { 
    name, 
    propertyType, 
    description, 
    city, 
    ward, 
    addressLine, 
    pets, 
    smoking, 
    sharedRules,
    rent,
    area_m2,
    custom_amenities,
  } = formData;
  
  // Validate recommended fields
  const warnings: Array<{ step: number; message: string }> = [];
  
  if (!description) {
    warnings.push({ step: 0, message: "Bước 1: Thiếu mô tả chi tiết" });
  }
  if (!city || !ward) {
    warnings.push({ step: 0, message: "Bước 1: Thiếu thông tin địa chỉ (tỉnh/phường)" });
  }
  if (!addressLine) {
    warnings.push({ step: 0, message: "Bước 1: Thiếu địa chỉ cụ thể" });
  }
  
  // Check rental arrangement details
  if (rentalArrangement === "WHOLE_SPACE") {
    if (!rent) {
      warnings.push({ step: 1, message: "Bước 2: Thiếu giá thuê tháng" });
    }
    if (!area_m2) {
      warnings.push({ step: 1, message: "Bước 2: Thiếu diện tích" });
    }
  } else {
    const unitsWithoutRent = rooms.filter((room) => !room.rent);
    const unitsWithoutArea = rooms.filter((room) => !room.area_m2);
    if (unitsWithoutRent.length > 0) {
      warnings.push({
        step: 1,
        message: `Bước 2: ${unitsWithoutRent.length} căn thiếu giá thuê`,
      });
    }
    if (unitsWithoutArea.length > 0) {
      warnings.push({
        step: 1,
        message: `Bước 2: ${unitsWithoutArea.length} căn thiếu diện tích`,
      });
    }
  }
  
  // Check amenities
  const propertyAmenityCount = sharedAmenityKeys.size;
  const customAmenitiesCount = custom_amenities.split("\n").filter(Boolean).length;
  if (propertyAmenityCount === 0 && customAmenitiesCount === 0) {
    warnings.push({ step: 2, message: "Bước 3: Chưa chọn tiện ích nào" });
  }
  
  // Check rules
  const rulesCount = sharedRules.split("\n").filter(Boolean).length;
  if (rulesCount === 0) {
    warnings.push({ step: 3, message: "Bước 4: Chưa có nội quy chung" });
  }
  
  const propertyTypeLabel: Record<string, string> = {
    HOUSE: "Nhà",
    APARTMENT: "Căn hộ",
    APARTMENT_BUILDING: "Tòa nhà căn hộ",
  };
  
  const petsLabel: Record<string, string> = {
    NOT_ALLOWED: "Không cho phép",
    WITH_APPROVAL: "Cần phê duyệt",
    ALLOWED: "Được phép",
  };
  
  const smokingLabel: Record<string, string> = {
    NOT_ALLOWED: "Không cho phép",
    OUTDOOR_ONLY: "Chỉ ngoài trời",
    ALLOWED: "Được phép",
  };

  return (
    <div className="space-y-5">
      {warnings.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <strong className="text-emerald-900">✓ Thông tin đã đầy đủ</strong>
          <p className="mt-1 text-sm text-emerald-800">
            Bản nháp sẵn sàng được tạo. Bạn có thể thêm ảnh sau khi lưu.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <strong className="text-amber-900">
            ⚠ Còn thiếu thông tin được khuyến nghị
          </strong>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {warnings.map((warning, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onNavigateToStep(warning.step)}
                  className="hover:underline"
                >
                  {warning.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => onNavigateToStep(0)}
          className="mb-3 flex w-full items-center justify-between text-left hover:text-[#3368a0]"
        >
          <h3 className="text-sm font-semibold text-slate-800">
            1. Thông tin cơ bản
          </h3>
          <span className="text-xs text-[#3368a0]">Chỉnh sửa →</span>
        </button>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Tên bất động sản:</span>
            <span className="font-medium text-slate-900">
              {name || <span className="text-amber-600">Chưa nhập</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Loại hình:</span>
            <span className="font-medium text-slate-900">
              {propertyTypeLabel[propertyType] || propertyType}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Mô tả:</span>
            <span className="font-medium text-slate-900">
              {description ? (
                `${description.slice(0, 50)}${description.length > 50 ? "..." : ""}`
              ) : (
                <span className="text-amber-600">Chưa nhập</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Địa chỉ:</span>
            <span className="font-medium text-slate-900">
              {city || ward || addressLine ? (
                <>
                  {addressLine && `${addressLine}, `}
                  {ward && `${ward}, `}
                  {city}
                </>
              ) : (
                <span className="text-amber-600">Chưa nhập</span>
              )}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => onNavigateToStep(1)}
          className="mb-3 flex w-full items-center justify-between text-left hover:text-[#3368a0]"
        >
          <h3 className="text-sm font-semibold text-slate-800">
            2. Hình thức thuê
          </h3>
          <span className="text-xs text-[#3368a0]">Chỉnh sửa →</span>
        </button>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Hình thức:</span>
            <span className="font-medium text-slate-900">
              {rentalArrangement === "WHOLE_SPACE"
                ? "Toàn bộ không gian"
                : "Cho thuê từng căn/phòng"}
            </span>
          </div>
          {rentalArrangement === "WHOLE_SPACE" ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-600">Giá thuê:</span>
                <span className="font-medium text-slate-900">
                  {rent ? (
                    `${Number(rent).toLocaleString()} ₫/tháng`
                  ) : (
                    <span className="text-amber-600">Chưa nhập</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Diện tích:</span>
                <span className="font-medium text-slate-900">
                  {area_m2 ? (
                    `${area_m2} m²`
                  ) : (
                    <span className="text-amber-600">Chưa nhập</span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-2 py-1 text-left">Căn</th>
                    <th className="px-2 py-1 text-right">Giá (₫)</th>
                    <th className="px-2 py-1 text-right">Diện tích</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="px-2 py-1">{room.label}</td>
                      <td className="px-2 py-1 text-right">
                        {room.rent ? (
                          Number(room.rent).toLocaleString()
                        ) : (
                          <span className="text-amber-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {room.area_m2 ? (
                          `${room.area_m2} m²`
                        ) : (
                          <span className="text-amber-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => onNavigateToStep(2)}
          className="mb-3 flex w-full items-center justify-between text-left hover:text-[#3368a0]"
        >
          <h3 className="text-sm font-semibold text-slate-800">
            3. Tiện ích
          </h3>
          <span className="text-xs text-[#3368a0]">Chỉnh sửa →</span>
        </button>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Tiện ích bất động sản:</span>
            <span className="font-medium text-slate-900">
              {propertyAmenityCount > 0 || customAmenitiesCount > 0 ? (
                `${propertyAmenityCount + customAmenitiesCount} tiện ích`
              ) : (
                <span className="text-amber-600">Chưa chọn</span>
              )}
            </span>
          </div>
          {propertyAmenityCount > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Array.from(sharedAmenityKeys)
                .slice(0, 5)
                .map((key) => {
                  const amenity = catalog.find((item) => item.key === key);
                  return amenity ? (
                    <span
                      key={key}
                      className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                    >
                      {amenity.label}
                    </span>
                  ) : null;
                })}
              {sharedAmenityKeys.size > 5 && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  +{sharedAmenityKeys.size - 5} khác
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => onNavigateToStep(3)}
          className="mb-3 flex w-full items-center justify-between text-left hover:text-[#3368a0]"
        >
          <h3 className="text-sm font-semibold text-slate-800">
            4. Quy định và nội quy
          </h3>
          <span className="text-xs text-[#3368a0]">Chỉnh sửa →</span>
        </button>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Thú cưng:</span>
            <span className="font-medium text-slate-900">
              {petsLabel[pets] || pets}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Hút thuốc:</span>
            <span className="font-medium text-slate-900">
              {smokingLabel[smoking] || smoking}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Nội quy chung:</span>
            <span className="font-medium text-slate-900">
              {rulesCount > 0 ? (
                `${rulesCount} quy tắc`
              ) : (
                <span className="text-amber-600">Chưa nhập</span>
              )}
            </span>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>Lưu ý:</strong> Sau khi tạo bản nháp, bạn có thể thêm ảnh và
        hoàn thiện thông tin trong trang quản lý bất động sản.
      </div>
    </div>
  );
}
