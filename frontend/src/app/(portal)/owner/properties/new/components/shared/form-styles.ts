import type { CSSProperties } from "react";

export const inputClass =
  "mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100";

export const textareaClass = inputClass.replace("mt-2", "mt-3");

export const selectClass = `${inputClass} cursor-pointer appearance-none bg-no-repeat bg-[length:1.125rem_1.125rem] pr-12`;

export const selectStyle: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='m6 8 4 4 4-4' stroke='%23475569' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 0.875rem center",
};

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export const shellClass =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm";
