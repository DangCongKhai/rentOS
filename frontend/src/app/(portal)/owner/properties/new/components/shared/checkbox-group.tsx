"use client";

import { inputClass } from "./form-styles";

type CheckboxGroupItem = {
  key: string;
  label: string;
  checked: boolean;
  detailsValue?: string;
};

type CheckboxGroupProps = {
  items: CheckboxGroupItem[];
  namePrefix: string;
  detailsNamePrefix: string;
  onChange: (key: string, checked: boolean) => void;
  gridCols?: "sm:grid-cols-2" | "sm:grid-cols-3";
};

export function CheckboxGroup({
  items,
  namePrefix,
  detailsNamePrefix,
  onChange,
  gridCols = "sm:grid-cols-2",
}: CheckboxGroupProps) {
  const allChecked = items.length > 0 && items.every((item) => item.checked);
  const noneChecked = items.every((item) => !item.checked);

  function handleCheckAll() {
    items.forEach((item) => {
      if (!item.checked) {
        onChange(item.key, true);
      }
    });
  }

  function handleUncheckAll() {
    items.forEach((item) => {
      if (item.checked) {
        onChange(item.key, false);
      }
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-600">
          {items.filter((item) => item.checked).length} / {items.length} đã chọn
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCheckAll}
            disabled={allChecked}
            className="text-xs font-medium text-[#3368a0] hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Chọn tất cả
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={handleUncheckAll}
            disabled={noneChecked}
            className="text-xs font-medium text-[#3368a0] hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Bỏ chọn tất cả
          </button>
        </div>
      </div>
      <div className={`grid gap-2 ${gridCols}`}>
        {items.map((item) => (
          <label
            key={item.key}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
          >
            <span className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name={`${namePrefix}${item.key}`}
                checked={item.checked}
                onChange={(event) => onChange(item.key, event.target.checked)}
                className="size-4 accent-[#3368a0]"
              />
              {item.label}
            </span>
            <input
              type="text"
              name={`${detailsNamePrefix}${item.key}`}
              maxLength={160}
              aria-label={`Ghi chú ${item.label}`}
              placeholder="Ghi chú tùy chọn"
              defaultValue={item.detailsValue}
              className={inputClass}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
