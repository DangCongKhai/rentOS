"use client";

import { useEffect, useRef, useState } from "react";
import { VietnamLocationPicker, type SelectedLocation } from "@/components/vietnam-location-picker";
import { inputClass, textareaClass, selectClass, selectStyle } from "./shared/form-styles";

const emptyLocation: SelectedLocation = { city: "", ward: "", cities: [], wards: [] };

export function addressMismatch(address: string, location: SelectedLocation): string {
  const value = address.trim();
  if (value === "") return "";
  if (!location.city || !location.ward) {
    return "Chọn tỉnh/thành và phường/xã trước khi nhập địa chỉ cụ thể.";
  }
  if (!value.includes(location.city) || !value.includes(location.ward)) {
    return `Địa chỉ phải chứa ${location.ward} và ${location.city}.`;
  }
  return "";
}

export function BasicInfoStep() {
  const [location, setLocation] = useState<SelectedLocation>(emptyLocation);
  const [address, setAddress] = useState("");
  const addressRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const addressError = addressMismatch(address, location);

  useEffect(() => {
    addressRef.current?.setCustomValidity(addressError);
  }, [addressError]);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700">
        Tên bất động sản
        <input
          ref={nameRef}
          name="name"
          required
          maxLength={255}
          defaultValue=""
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
          ref={descriptionRef}
          name="description"
          rows={3}
          maxLength={10000}
          defaultValue=""
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
          onChange={(event) => {
            const nextAddress = event.target.value;
            setAddress(nextAddress);
            event.target.setCustomValidity(addressMismatch(nextAddress, location));
          }}
          aria-invalid={addressError !== ""}
          className={`${inputClass} ${addressError ? "border-rose-500 bg-rose-50" : ""}`}
          placeholder="Số nhà, tên đường"
        />
        {addressError ? (
          <span role="alert" className="mt-1 block text-xs font-medium text-rose-700">
            ❌ {addressError}
          </span>
        ) : null}
      </label>
    </div>
  );
}
