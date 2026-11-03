"use client";

import { VietnamLocationPicker } from "@/components/vietnam-location-picker";
import { inputClass, textareaClass, selectClass, selectStyle } from "./shared/form-styles";

export function BasicInfoStep() {
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
      <VietnamLocationPicker required={false} />
      <label className="block text-sm font-semibold text-slate-700">
        Địa chỉ cụ thể
        <input
          name="address_line"
          maxLength={500}
          className={inputClass}
          placeholder="Số nhà, tên đường"
        />
      </label>
    </div>
  );
}
