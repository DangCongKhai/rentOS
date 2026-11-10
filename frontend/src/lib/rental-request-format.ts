import type { TenantRentalRequest } from "./rental-requests-api";

export const statuses = {
  PENDING: { label: "Đang chờ xử lý", color: "bg-amber-100 text-amber-900" },
  ACCEPTED: { label: "Đã chấp nhận", color: "bg-blue-100 text-blue-900" },
  REJECTED: { label: "Đã từ chối", color: "bg-red-100 text-red-800" },
  WITHDRAWN: { label: "Đã rút lại", color: "bg-slate-200 text-slate-700" },
};

export const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
});
const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh",
});

function dateOnly(value: string) {
  const [year, month, day] = value.split("-");
  return day + "/" + month + "/" + year;
}

export function timestamp(value: string) {
  const date = new Date(value);
  return timeFormat.format(date) + " " + dateFormat.format(date);
}

export function dateRange(item: Pick<TenantRentalRequest, "desired_move_in_date" | "desired_end_date">) {
  return dateOnly(item.desired_move_in_date) + " – " + dateOnly(item.desired_end_date);
}
