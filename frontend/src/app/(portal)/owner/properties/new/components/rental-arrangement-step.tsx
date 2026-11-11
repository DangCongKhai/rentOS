"use client";

import {
  inputClass,
  textareaClass,
  selectClass,
  selectStyle,
  secondaryButton,
} from "./shared/form-styles";
import type { RoomDraft } from "./shared/types";

type RentalArrangementStepProps = {
  rentalArrangement: "WHOLE_SPACE" | "SEPARATE_UNITS";
  onRentalArrangementChange: (value: "WHOLE_SPACE" | "SEPARATE_UNITS") => void;
  unitCount: number;
  unitPrefix: string;
  startNumber: number;
  rooms: RoomDraft[];
  activeUnitIndex: number;
  duplicateLabels: Set<string>;
  onUpdateUnitDefaults: (count: number, prefix: string, start: number) => void;
  onUpdateRoom: (
    index: number,
    patch: Partial<RoomDraft>,
    customized?: boolean,
  ) => void;
  onApplyRoomToEmpty: (index: number) => void;
  onSetActiveUnit: (index: number) => void;
};

function ArrangementOption({
  value,
  label,
  description,
  checked,
  onChange,
}: {
  value: "WHOLE_SPACE" | "SEPARATE_UNITS";
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border bg-white p-3 ${checked ? "border-[#3368a0]" : "border-slate-200"}`}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="radio"
          name="rental_arrangement"
          value={value}
          checked={checked}
          onChange={onChange}
          className="accent-[#3368a0]"
        />
        <span className="text-sm font-semibold text-slate-900">{label}</span>
      </label>
      <span className="group relative shrink-0">
        <button
          type="button"
          aria-label={`Giải thích ${label}`}
          className="flex size-6 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-600 hover:border-[#3368a0] hover:text-[#3368a0]"
        >
          !
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-20 hidden w-56 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600 shadow-lg group-hover:block group-focus-within:block"
        >
          {description}
        </span>
      </span>
    </div>
  );
}

export function RentalArrangementStep({
  rentalArrangement,
  onRentalArrangementChange,
  unitCount,
  unitPrefix,
  startNumber,
  rooms,
  activeUnitIndex,
  onUpdateUnitDefaults,
  onUpdateRoom,
  onApplyRoomToEmpty,
  onSetActiveUnit,
}: RentalArrangementStepProps) {
  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">
          Hình thức cho thuê
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ArrangementOption
            value="WHOLE_SPACE"
            label="Toàn bộ không gian"
            description="Cho thuê toàn bộ căn nhà hoặc căn hộ."
            checked={rentalArrangement === "WHOLE_SPACE"}
            onChange={() => onRentalArrangementChange("WHOLE_SPACE")}
          />
          <ArrangementOption
            value="SEPARATE_UNITS"
            label="Cho thuê từng căn/phòng"
            description="Tạo nhiều căn/phòng trong cùng bất động sản."
            checked={rentalArrangement === "SEPARATE_UNITS"}
            onChange={() => onRentalArrangementChange("SEPARATE_UNITS")}
          />
        </div>
      </fieldset>
      {rentalArrangement === "WHOLE_SPACE" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">
            Thông tin căn
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Giá thuê tháng (₫)
              <input name="rent" type="number" min={1} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tiền đặt cọc (₫)
              <input
                name="deposit"
                type="number"
                min={0}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Thời hạn thuê tối thiểu (tháng)
              <input
                name="minimum_rental_months"
                type="number"
                min={3}
                defaultValue={3}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Số người tối đa
              <input
                name="max_occupants"
                type="number"
                min={1}
                defaultValue={1}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Loại căn
              <select
                name="unit_kind"
                className={selectClass}
                style={selectStyle}
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
                min={0.1}
                step={0.1}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Phòng ngủ
              <input
                name="bedrooms"
                type="number"
                min={0}
                defaultValue={0}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Phòng tắm
              <input
                name="bathrooms"
                type="number"
                min={0}
                defaultValue={1}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Mô tả
              <textarea
                name="unit_description"
                rows={2}
                className={textareaClass}
              />
            </label>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Danh sách căn/phòng
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Số lượng
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={unitCount}
                  onChange={(event) =>
                    onUpdateUnitDefaults(
                      Number(event.target.value) || 1,
                      unitPrefix,
                      startNumber,
                    )
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Tiền tố
                <input
                  value={unitPrefix}
                  onChange={(event) =>
                    onUpdateUnitDefaults(
                      unitCount,
                      event.target.value,
                      startNumber,
                    )
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Số bắt đầu
                <input
                  type="number"
                  value={startNumber}
                  onChange={(event) =>
                    onUpdateUnitDefaults(
                      unitCount,
                      unitPrefix,
                      Number(event.target.value) || 1,
                    )
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Chọn từng phòng bên dưới để nhập thông tin. Có thể sao chép phòng
              đang xem sang các phòng chưa chỉnh.
            </p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Tùy chỉnh từng căn
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Thời hạn thuê tối thiểu là 3 tháng và số người tối đa là 1,
                  trừ khi bạn đổi.
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">
                {activeUnitIndex + 1} / {rooms.length}
              </span>
            </div>
            <div
              role="tablist"
              aria-label="Chọn căn để tùy chỉnh"
              className="mt-3 flex gap-2 overflow-x-auto pb-2"
            >
              {rooms.map((room, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={activeUnitIndex === index}
                  onClick={() => onSetActiveUnit(index)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${activeUnitIndex === index ? "border-[#3368a0] bg-[#3368a0] text-white" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  {room.label.trim() || `Căn ${index + 1}`}
                </button>
              ))}
            </div>
            {rooms.map((room, index) => (
              <fieldset
                key={index}
                role="tabpanel"
                hidden={activeUnitIndex !== index}
                className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"
              >
                <legend className="sr-only">
                  Tùy chỉnh {room.label || `căn ${index + 1}`}
                </legend>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Tên căn
                  <input
                    aria-label={`Tên căn ${index + 1}`}
                    name={`new_${index}_label`}
                    value={room.label}
                    onChange={(event) =>
                      onUpdateRoom(
                        index,
                        {
                          label: event.target.value,
                          labelEdited: true,
                        },
                        false,
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Loại căn
                  <select
                    name={`new_${index}_unit_kind`}
                    value={room.unit_kind}
                    onChange={(event) =>
                      onUpdateRoom(index, {
                        unit_kind: event.target.value,
                      })
                    }
                    className={selectClass}
                    style={selectStyle}
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
                    name={`new_${index}_area_m2`}
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={room.area_m2}
                    onChange={(event) =>
                      onUpdateRoom(index, { area_m2: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Giá thuê tháng (₫)
                  <input
                    name={`new_${index}_rent`}
                    type="number"
                    min="1"
                    value={room.rent}
                    onChange={(event) =>
                      onUpdateRoom(index, { rent: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Tiền đặt cọc (₫)
                  <input
                    name={`new_${index}_deposit`}
                    type="number"
                    min="0"
                    value={room.deposit}
                    onChange={(event) =>
                      onUpdateRoom(index, { deposit: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Thời hạn thuê tối thiểu
                  <input
                    name={`new_${index}_minimum_rental_months`}
                    type="number"
                    min="3"
                    value={room.minimum_rental_months}
                    onChange={(event) =>
                      onUpdateRoom(index, {
                        minimum_rental_months: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Số người tối đa
                  <input
                    name={`new_${index}_max_occupants`}
                    type="number"
                    min="1"
                    value={room.max_occupants}
                    onChange={(event) =>
                      onUpdateRoom(index, {
                        max_occupants: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Phòng ngủ
                  <input
                    name={`new_${index}_bedrooms`}
                    type="number"
                    min="0"
                    value={room.bedrooms}
                    onChange={(event) =>
                      onUpdateRoom(index, {
                        bedrooms: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Phòng tắm
                  <input
                    name={`new_${index}_bathrooms`}
                    type="number"
                    min="0"
                    value={room.bathrooms}
                    onChange={(event) =>
                      onUpdateRoom(index, {
                        bathrooms: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Mô tả
                  <textarea
                    name={`new_${index}_description`}
                    rows={2}
                    value={room.description}
                    onChange={(event) =>
                      onUpdateRoom(index, {
                        description: event.target.value,
                      })
                    }
                    className={textareaClass}
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => onApplyRoomToEmpty(index)}
                    className={secondaryButton}
                  >
                    Áp dụng cho các phòng chưa chỉnh riêng
                  </button>
                </div>
              </fieldset>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
