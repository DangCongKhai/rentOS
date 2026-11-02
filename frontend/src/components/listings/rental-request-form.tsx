"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ListingDetail } from "@/features/discovery/listings-api";

export function RentalRequestForm({
  listing,
  isSignedIn,
  preferredUnitId,
  onPreferredUnitChange,
}: {
  listing: Pick<ListingDetail, "title" | "property" | "units">;
  isSignedIn: boolean;
  preferredUnitId: string;
  onPreferredUnitChange: (unitId: string) => void;
}) {
  const router = useRouter();
  const [phoneError, setPhoneError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = listing.units.some((unit) => unit.id === preferredUnitId)
    ? preferredUnitId
    : listing.units[0]?.id ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!isSignedIn) {
      router.push("/login");
      return;
    }

    const values = new FormData(event.currentTarget);
    const phone = String(values.get("phone") ?? "").trim();
    const name = String(values.get("name") ?? "").trim();
    const message = String(values.get("message") ?? "").trim();
    const moveIn = String(values.get("move_in_date") ?? "");
    if (!name || !phone || !message || !moveIn) {
      setPhoneError(phone ? "Điền tên, lời nhắn và ngày dọn vào." : "Nhập số điện thoại.");
      return;
    }

    setPhoneError("");
    setNotice("Chưa gửi yêu cầu. Việc gửi tới chủ nhà sẽ được nối sau.");
  }

  return (
    <form className="grid gap-3" aria-label="Gửi yêu cầu thuê" onSubmit={handleSubmit}>
      <p className="text-sm leading-5 text-[#091216]">
        Sau khi bạn gửi yêu cầu, chủ nhà liên lạc qua số điện thoại bạn cung cấp để trao đổi và hẹn xem nhà.
      </p>
      <label className="grid gap-1 text-sm font-medium text-[#091216]">
        Tên liên hệ
        <input name="name" className="min-h-11 rounded-xl border border-[#d5dee7] bg-white px-3 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-[#091216]">
        Số điện thoại
        <input name="phone" inputMode="tel" className="min-h-11 rounded-xl border border-[#d5dee7] bg-white px-3 font-normal" aria-describedby="phone-hint" />
        <span id="phone-hint" className="font-normal text-[#5b6676]">Chủ nhà sẽ liên lạc với bạn qua số này.</span>
      </label>
      <label className="grid gap-1 text-sm font-medium text-[#091216]">
        Ngày dọn vào mong muốn
        <input name="move_in_date" type="date" className="min-h-11 rounded-xl border border-[#d5dee7] bg-white px-3 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-[#091216]">
        Căn ưu tiên
        <select
          name="unit_id"
          value={selected}
          onChange={(event) => onPreferredUnitChange(event.target.value)}
          className="min-h-11 rounded-xl border border-[#d5dee7] bg-white px-3 font-normal"
        >
          {listing.units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.label}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-[#091216]">
        Lời nhắn cho chủ nhà
        <textarea name="message" className="min-h-24 rounded-xl border border-[#d5dee7] bg-white px-3 py-2 font-normal" />
      </label>
      {phoneError ? <p role="alert" className="text-sm text-[#9b2c2c]">{phoneError}</p> : null}
      {notice ? <p role="status" className="text-sm text-[#14692f]">{notice}</p> : null}
      <button type="submit" className="min-h-11 rounded-[15px] bg-[#3368a0] px-5 text-[15px] font-semibold text-white">
        Gửi yêu cầu thuê
      </button>
      <p className="text-[13px] leading-5 text-[#5b6676]">Gửi yêu cầu không đồng nghĩa với việc giữ chỗ.</p>
    </form>
  );
}
