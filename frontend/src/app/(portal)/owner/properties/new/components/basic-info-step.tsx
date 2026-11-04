"use client";

import { useEffect, useRef, useState } from "react";
import { VietnamLocationPicker, type SelectedLocation } from "@/components/vietnam-location-picker";
import { inputClass, textareaClass, selectClass, selectStyle } from "./shared/form-styles";

const emptyLocation: SelectedLocation = { city: "", ward: "", cities: [], wards: [] };

function addressMismatch(address: string, location: SelectedLocation): string {
  const value = address.trim();
  if (value === "") return "";
  if (!location.city || !location.ward) {
    return "Chọn tỉnh/thành và phường/xã trước khi nhập địa chỉ cụ thể.";
  }

  const normalized = value.toLocaleLowerCase("vi");
  const otherCity = location.cities.find(
    (name) => name !== location.city && normalized.includes(name.toLocaleLowerCase("vi")),
  );
  if (otherCity) {
    return `Địa chỉ ghi ${otherCity}, nhưng tỉnh/thành đã chọn là ${location.city}.`;
  }

  const otherWard = location.wards.find(
    (name) => name !== location.ward && name.length > 2 && normalized.includes(name.toLocaleLowerCase("vi")),
  );
  if (otherWard) {
    return `Địa chỉ ghi ${otherWard}, nhưng phường/xã đã chọn là ${location.ward}.`;
  }

  return "";
}

export function BasicInfoStep() {
  const [location, setLocation] = useState<SelectedLocation>(emptyLocation);
  const [address, setAddress] = useState("");
  const addressRef = useRef<HTMLInputElement>(null);
  const addressError = addressMismatch(address, location);

  useEffect(() => {
    addressRef.current?.setCustomValidity(addressError);
  }, [addressError]);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700">
        Tên bất động sản
        <input
          name="name"
          required
          maxLength={255}
          className={inputClass}
          placeholder="Ví dụ: Căn hộ gần biển Mỹ Khê"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Loại hình bất động sản
        <select
          name="property_type"
          className={selectClass}
          style={selectStyle}
          defaultValue="APARTMENT"
        >
          <option value="HOUSE">Nhà</option>
          <option value="APARTMENT">Căn hộ</option>
          <option value="APARTMENT_BUILDING">Tòa nhà căn hộ</option>
        </select>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Mô tả chi tiết
        <textarea
          name="description"
          rows={3}
          maxLength={10000}
          className={textareaClass}
          placeholder="Mô tả vị trí, không gian và điểm nổi bật."
        />
      </label>
      <VietnamLocationPicker required={false} onLocationChange={setLocation} />
      <label className="block text-sm font-semibold text-slate-700">
        Địa chỉ cụ thể
        <input
          ref={addressRef}
          name="address_line"
          maxLength={500}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          aria-invalid={addressError !== ""}
          className={inputClass}
          placeholder="Số nhà, tên đường"
        />
        {addressError ? (
          <span role="alert" className="mt-1 block text-xs font-medium text-rose-700">
            {addressError}
          </span>
        ) : null}
      </label>
    </div>
  );
}
