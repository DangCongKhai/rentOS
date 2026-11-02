"use client";

import Image from "next/image";
import type { PublicUnit } from "@/features/discovery/listings-api";
import { dong, kindLabels, meters } from "./listing-format";
import { UnitDetailDialog } from "./unit-detail-dialog";

export function AvailableUnits({
  units,
  selectedUnitId,
  openUnitId,
  onChoose,
  onClose,
}: {
  units: PublicUnit[];
  selectedUnitId: string;
  openUnitId: string | null;
  onChoose: (unitId: string) => void;
  onClose: () => void;
}) {
  const openUnit = units.find((unit) => unit.id === openUnitId) ?? null;
  return (
    <section className="grid gap-4" aria-label="Các căn">
      <h2 className="text-2xl font-bold text-[#091216]">Các căn</h2>
      <p className="rounded-xl bg-[#e8f3ff] px-4 py-3 text-sm text-[#1f3a5c]">
        Chọn một căn để xem chi tiết. Căn đang chọn sẽ được đưa vào yêu cầu thuê.
      </p>
      <div className="overflow-hidden rounded-2xl border border-[#e1e7ed]">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_120px_160px_140px_28px] gap-3 bg-[#f7f8fa] px-4 py-3 text-sm font-semibold text-[#3368a0] md:grid">
          <span>Căn</span>
          <span>Diện tích</span>
          <span>Tình trạng</span>
          <span>Giá thuê</span>
          <span className="sr-only">Xem chi tiết</span>
        </div>
        <ul>
          {units.map((unit) => {
            const selected = selectedUnitId === unit.id;
            const photo = unit.photos[0];
            const available = unit.availability_label.startsWith("Còn trống");
            return (
              <li key={unit.id} className={selected ? "bg-[#f3f8fd]" : "bg-white"}>
                <button
                  type="button"
                  className="grid w-full gap-3 border-t border-[#e1e7ed] px-4 py-4 text-left md:grid-cols-[minmax(0,1.6fr)_120px_160px_140px_28px] md:items-center"
                  onClick={() => onChoose(unit.id)}
                >
                  <span className="flex items-center gap-3">
                    {photo ? (
                      <span className="relative block h-14 w-16 shrink-0 overflow-hidden rounded-lg">
                        <Image src={photo.url} alt="" fill sizes="64px" className="object-cover" />
                      </span>
                    ) : (
                      <span className="h-14 w-16 rounded-lg bg-[#e8ebf0]" />
                    )}
                    <span>
                      <span className="block font-bold text-[#091216]">{unit.label}</span>
                      <span className="block text-sm text-[#454e5c]">
                        {unit.bedrooms > 0 ? `${unit.bedrooms} phòng ngủ, ` : ""}
                        {Number(unit.bathrooms) >= 1 ? `${meters(Number(unit.bathrooms))} phòng tắm` : "WC chung"}
                      </span>
                      <span className="block text-xs text-[#5b6676]">{kindLabels[unit.unit_kind] ?? unit.unit_kind}</span>
                    </span>
                  </span>
                  <span className="text-sm text-[#091216]">{meters(Number(unit.area_m2))} m²</span>
                  <span className={`text-sm font-medium ${available ? "text-[#14692f]" : "text-[#454e5c]"}`}>{unit.availability_label}</span>
                  <span className="text-sm font-bold text-[#091216]">{dong(Number(unit.advertised_monthly_rent))}</span>
                  <span className="text-[#3368a0]" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {openUnit ? <UnitDetailDialog unit={openUnit} onClose={onClose} /> : null}
    </section>
  );
}
