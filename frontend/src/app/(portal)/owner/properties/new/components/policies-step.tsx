"use client";

import { textareaClass, selectClass, selectStyle } from "./shared/form-styles";

type PoliciesStepProps = {
  rentalArrangement: "WHOLE_SPACE" | "SEPARATE_UNITS";
  unitLabels: string[];
  activeUnitIndex: number;
  onSetActiveUnit: (index: number) => void;
};

export function PoliciesStep({
  rentalArrangement,
  unitLabels,
  activeUnitIndex,
  onSetActiveUnit,
}: PoliciesStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">
          Quy định chung
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Quy định thú cưng và hút thuốc được áp dụng cho mọi căn trừ khi thay
          đổi sau này.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Thú cưng
          <select
            name="pets"
            defaultValue="NOT_ALLOWED"
            className={selectClass}
            style={selectStyle}
          >
            <option value="NOT_ALLOWED">Không cho phép</option>
            <option value="WITH_APPROVAL">Cần phê duyệt</option>
            <option value="ALLOWED">Được phép</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Hút thuốc
          <select
            name="smoking"
            defaultValue="NOT_ALLOWED"
            className={selectClass}
            style={selectStyle}
          >
            <option value="NOT_ALLOWED">Không cho phép</option>
            <option value="OUTDOOR_ONLY">Chỉ ngoài trời</option>
            <option value="ALLOWED">Được phép</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Nội quy chung
        <textarea
          name="shared_rules"
          rows={3}
          className={textareaClass}
          placeholder="Mỗi dòng một nội quy dùng chung"
        />
      </label>
      {rentalArrangement === "SEPARATE_UNITS" && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Nội quy riêng từng căn
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Nội quy chung được kế thừa; chỉ nhập thêm điều khác biệt cho
                căn đang chọn.
              </p>
            </div>
            <span className="shrink-0 text-xs text-slate-500">
              {activeUnitIndex + 1} / {unitLabels.length}
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Chọn căn để nhập nội quy riêng"
            className="mt-3 flex gap-2 overflow-x-auto pb-2"
          >
            {unitLabels.map((label, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={activeUnitIndex === index}
                onClick={() => onSetActiveUnit(index)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${activeUnitIndex === index ? "border-[#3368a0] bg-[#3368a0] text-white" : "border-slate-200 bg-white text-slate-700"}`}
              >
                {label.trim() || `Căn ${index + 1}`}
              </button>
            ))}
          </div>
          {unitLabels.map((label, index) => (
            <label
              key={index}
              hidden={activeUnitIndex !== index}
              className="mt-2 block text-sm font-medium text-slate-700"
            >
              Nội quy bổ sung cho {label || `căn ${index + 1}`}
              <textarea
                name={`new_${index}_additional_rules`}
                rows={3}
                className={textareaClass}
                placeholder="Không nhập lại nội quy chung."
              />
            </label>
          ))}
        </section>
      )}
    </div>
  );
}
