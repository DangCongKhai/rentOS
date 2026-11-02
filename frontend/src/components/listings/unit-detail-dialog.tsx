"use client";

import { useEffect } from "react";
import type { PublicUnit } from "@/features/discovery/listings-api";
import { amenityIcon, ListingIcon } from "./listing-icon";
import { dong, kindLabels, meters, petLabels } from "./listing-format";
import { ListingPhotoGrid } from "./listing-photo-grid";

export function UnitDetailDialog({
  unit,
  onClose,
}: {
  unit: PublicUnit;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const baths = Number(unit.bathrooms);
  const slides = unit.photos.map((photo) => ({
    key: photo.id,
    url: photo.url,
    label: photo.caption || unit.label,
  }));

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 sm:p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết ${unit.label}`}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#f4f6f8] p-4 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.96px] text-[#3368a0]">{kindLabels[unit.unit_kind] ?? unit.unit_kind}</p>
            <h2 className="text-2xl font-bold text-[#091216]">{unit.label}</h2>
          </div>
          <button type="button" className="min-h-10 rounded-lg border border-[#d5dee7] bg-white px-3 text-sm font-semibold" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="grid gap-6">
          <ListingPhotoGrid slides={slides} />
          <div className="grid gap-3">
            <span className={`w-fit rounded-full px-3 py-1 text-[13px] font-semibold ${unit.availability_label.startsWith("Còn trống") ? "bg-[#ddf3e4] text-[#14692f]" : "bg-[#e8ebf0] text-[#454e5c]"}`}>
              {unit.availability_label}
            </span>
            <p>
              <span className="text-3xl font-bold text-[#091216]">{dong(Number(unit.advertised_monthly_rent))}</span>
              <span className="text-lg text-[#454e5c]"> /tháng</span>
            </p>
            <div className="flex flex-wrap gap-8 border-y border-[#e1e7ed] py-4">
              <Fact value={unit.bedrooms > 0 ? `${unit.bedrooms} phòng ngủ` : "Không tách phòng ngủ"} caption="Phòng ngủ" />
              <Fact value={baths >= 1 ? `${meters(baths)} phòng tắm` : "WC chung"} caption="Phòng tắm" />
              <Fact value={`${meters(Number(unit.area_m2))} m²`} caption="Diện tích" />
            </div>
          </div>

          {unit.description ? <p className="text-base leading-7 text-[#2b3544]">{unit.description}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Spec title="Tiền đặt cọc" body={dong(Number(unit.deposit))} />
            <Spec title="Thời hạn thuê tối thiểu" body={`${unit.minimum_rental_months} tháng`} />
            <Spec title="Số người tối đa" body={`${unit.max_occupants} người`} />
            <Spec title="Thú cưng" body={petLabels[unit.pets ?? ""] ?? "Hỏi chủ nhà"} />
            {unit.held_start && unit.held_end ? <Spec title="Giữ chỗ" body={`${unit.held_start} – ${unit.held_end}`} /> : null}
          </div>

          <section aria-label={`Tiện ích trong căn ${unit.label}`} className="grid gap-3">
            <h3 className="text-xl font-bold text-[#091216]">Tiện ích trong căn</h3>
            {unit.amenities.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3">
                {unit.amenities.map((amenity) => (
                  <li key={amenity.key} className="grid gap-1 rounded-xl bg-[#eaf1f7] p-4">
                    <ListingIcon name={amenityIcon(amenity.key)} size={22} />
                    <p className="font-bold text-[#091216]">{amenity.label_vi}</p>
                    {amenity.details ? <p className="text-[13px] text-[#5b6676]">{amenity.details}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#5b6676]">Căn này không khai báo tiện ích trong danh mục.</p>
            )}
          </section>

          {unit.custom_amenities.length > 0 ? (
            <p className="text-sm text-[#454e5c]">
              <span className="font-bold">Tiện ích bổ sung</span>
              {` (không dùng để lọc tìm kiếm): ${unit.custom_amenities.join(" · ")}`}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Fact({ value, caption }: { value: string; caption: string }) {
  return (
    <p>
      <span className="block text-lg font-bold text-[#091216]">{value}</span>
      <span className="block text-sm text-[#5b6676]">{caption}</span>
    </p>
  );
}

function Spec({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#d5dee7] bg-white px-4 py-3">
      <p className="font-semibold text-[#091216]">{title}</p>
      <p className="text-sm text-[#454e5c]">{body}</p>
    </div>
  );
}
