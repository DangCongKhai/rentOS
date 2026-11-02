"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clearLocation, parseListingSearchParams, toListingSearchParams, type ListingSearchState } from "./listing-search-params";
import type { AmenityCatalogItem } from "./listings-api";

const unitKinds = [
  { value: "", label: "Mọi loại căn" },
  { value: "ROOM", label: "Phòng" },
  { value: "STUDIO", label: "Studio" },
  { value: "APARTMENT", label: "Căn hộ" },
  { value: "HOUSE", label: "Nhà" },
];

const petOptions = [
  { value: "", label: "Mọi chính sách" },
  { value: "ALLOWED", label: "Cho nuôi thú cưng" },
  { value: "ASK_OWNER", label: "Hỏi chủ nhà" },
  { value: "NOT_ALLOWED", label: "Không nuôi thú" },
];

const roomCounts = ["", "1", "2", "3", "4", "5"];

type BarPanel = "price" | "rooms" | "kind";

export function ListingFilters({
  query,
  amenities,
  filtersOpen,
  onToggleFilters,
}: {
  query: string;
  amenities: AmenityCatalogItem[];
  filtersOpen: boolean;
  onToggleFilters: () => void;
}) {
  const router = useRouter();
  const state = parseListingSearchParams(new URLSearchParams(query));
  const [panel, setPanel] = useState<BarPanel | null>(null);

  function visit(next: ListingSearchState) {
    const params = toListingSearchParams({ ...next, page: 1 });
    const text = params.toString();
    router.replace(text ? `/listings?${text}` : "/listings");
  }

  function togglePanel(next: BarPanel) {
    setPanel((current) => (current === next ? null : next));
  }

  const kindLabel = unitKinds.find((kind) => kind.value === state.unitKind)?.label ?? "Loại căn";
  const filterCount = state.amenities.length + (state.pets ? 1 : 0) + (state.moveInDate ? 1 : 0);

  return (
    <section className="relative grid gap-3" aria-label="Bộ lọc tin đăng">
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <div className="relative min-w-0 flex-1 basis-full md:basis-auto">
          <label htmlFor="listing-location" className="sr-only">Địa điểm</label>
          <input
            id="listing-location"
            value={state.location}
            onChange={(event) => visit({ ...state, location: event.target.value })}
            placeholder="Sơn Trà, Đà Nẵng"
            className="h-11 w-full rounded-full border border-[#e1e7ed] bg-white pr-10 pl-4 text-sm"
          />
          {state.location ? (
            <button
              type="button"
              aria-label="Xóa địa điểm"
              className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-[#5b6676]"
              onClick={() => {
                const next = clearLocation(new URLSearchParams(query));
                const text = next.toString();
                router.replace(text ? `/listings?${text}` : "/listings");
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <AnchoredMenu
          open={panel === "price"}
          selected={Boolean(state.minRent || state.maxRent)}
          onToggle={() => togglePanel("price")}
          onClose={() => setPanel(null)}
          label={priceLabel(state)}
          menuClassName="w-[360px]"
        >
          <PriceMenu
            state={state}
            onApply={(minRent, maxRent) => {
              visit({ ...state, minRent, maxRent });
              setPanel(null);
            }}
          />
        </AnchoredMenu>
        <AnchoredMenu
          open={panel === "rooms"}
          onToggle={() => togglePanel("rooms")}
          onClose={() => setPanel(null)}
          label={roomsLabel(state)}
        >
          <RoomsMenu
            state={state}
            onApply={(bedrooms, bathrooms) => {
              visit({ ...state, bedrooms, bathrooms });
              setPanel(null);
            }}
          />
        </AnchoredMenu>
        <AnchoredMenu
          open={panel === "kind"}
          onToggle={() => togglePanel("kind")}
          onClose={() => setPanel(null)}
          label={state.unitKind ? kindLabel : "Loại căn"}
        >
          <div className="grid gap-1 p-2">
            {unitKinds.map((kind) => (
              <button
                key={kind.value || "any-kind"}
                type="button"
                aria-pressed={state.unitKind === kind.value}
                className={`min-h-10 rounded-lg px-3 text-left text-sm ${state.unitKind === kind.value ? "bg-[#eaf1f7] font-semibold text-[#3368a0]" : "hover:bg-[#f0f4f7]"}`}
                onClick={() => {
                  visit({ ...state, unitKind: kind.value });
                  setPanel(null);
                }}
              >
                {kind.label}
              </button>
            ))}
          </div>
        </AnchoredMenu>
        <button type="button" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#c9d3e0] bg-white px-4 text-sm font-semibold whitespace-nowrap" onClick={onToggleFilters}>
          <FilterIcon />
          Bộ lọc
          {filterCount > 0 ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3368a0] px-1 text-xs text-white">{filterCount}</span> : null}
        </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state.amenities.map((key) => {
          const label = amenities.find((item) => item.key === key)?.label_vi ?? key;
          return (
            <button key={key} type="button" className="rounded-full bg-[#eaf1f7] px-3 py-1 text-sm" onClick={() => visit({ ...state, amenities: state.amenities.filter((item) => item !== key) })}>
              {label} <span aria-hidden="true">×</span>
              <span className="sr-only">Bỏ {label}</span>
            </button>
          );
        })}
      </div>
      {filtersOpen ? (
        <FilterDialog
          state={state}
          amenities={amenities}
          onClose={onToggleFilters}
          onApply={(next) => {
            visit(next);
            onToggleFilters();
          }}
        />
      ) : null}
    </section>
  );
}

function AnchoredMenu({
  open,
  selected = false,
  label,
  onToggle,
  onClose,
  menuClassName = "w-80",
  children,
}: {
  open: boolean;
  selected?: boolean;
  label: string;
  onToggle: () => void;
  onClose: () => void;
  menuClassName?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!rect || !menu) return;
      const width = menu.offsetWidth;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setBox({ top: rect.bottom + 8, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-expanded={open} onClick={onToggle} className={`inline-flex h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm whitespace-nowrap ${open || selected ? "border-[#3368a0] text-[#3368a0]" : "border-[#e1e7ed]"}`}>
        {label}
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open ? createPortal(
        <div
          ref={menuRef}
          style={{ top: box?.top ?? 0, left: box?.left ?? 0, visibility: box ? "visible" : "hidden" }}
          className={`fixed z-[60] overflow-hidden rounded-2xl border border-[#e1e7ed] bg-white shadow-[0_16px_40px_rgba(9,18,22,0.18)] ${menuClassName}`}
        >
          {children}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function PriceMenu({ state, onApply }: { state: ListingSearchState; onApply: (minRent: string, maxRent: string) => void }) {
  const [minText, setMinText] = useState(() => vndToMillionsInput(state.minRent));
  const [maxText, setMaxText] = useState(() => vndToMillionsInput(state.maxRent));
  const minRent = millionsInputToVnd(minText);
  const maxRent = millionsInputToVnd(maxText);
  const rangeError = minRent !== "" && maxRent !== "" && Number(maxRent) < Number(minRent);

  return (
    <form
      className="grid w-full min-w-0 gap-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (rangeError) return;
        onApply(minRent, maxRent);
      }}
    >
      <p className="text-sm font-semibold text-[#091216]">Khoảng giá</p>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <MillionField label="Tối thiểu" value={minText} onChange={setMinText} />
        <span className="pb-3 text-[#5b6676]" aria-hidden="true">–</span>
        <MillionField label="Tối đa" value={maxText} onChange={setMaxText} invalid={rangeError} describedBy={rangeError ? "price-range-error" : undefined} />
      </div>
      {rangeError ? (
        <p id="price-range-error" role="alert" className="text-sm font-medium text-[#c53636]">
          Giá tối đa đang nhỏ hơn giá tối thiểu
        </p>
      ) : null}
      <button type="submit" disabled={rangeError} className="min-h-11 rounded-xl bg-[#3368a0] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        Xem kết quả
      </button>
    </form>
  );
}

function MillionField({
  label,
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-medium text-[#5b6676]">
      {label} (triệu VNĐ)
      <span className={`flex h-11 min-w-0 items-center gap-1 rounded-xl border bg-white px-3 ${invalid ? "border-[#c53636]" : "border-[#e1e7ed]"}`}>
        <input
          inputMode="decimal"
          value={value}
          placeholder="Không giới hạn"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(sanitizeMillions(event.target.value))}
          className="w-full min-w-0 bg-transparent text-sm text-[#091216] outline-none"
        />
      </span>
    </label>
  );
}

function RoomsMenu({
  state,
  onApply,
}: {
  state: ListingSearchState;
  onApply: (bedrooms: string, bathrooms: string) => void;
}) {
  const [bedrooms, setBedrooms] = useState(state.bedrooms);
  const [bathrooms, setBathrooms] = useState(state.bathrooms);

  return (
    <form
      className="grid w-full min-w-0 gap-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(bedrooms, bathrooms);
      }}
    >
      <CountRow label="Phòng ngủ" value={bedrooms} onChange={setBedrooms} />
      <CountRow label="Phòng tắm" value={bathrooms} onChange={setBathrooms} />
      <button type="submit" className="min-h-11 rounded-xl bg-[#3368a0] font-semibold text-white">Xem kết quả</button>
    </form>
  );
}

function CountRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-[#091216]">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {roomCounts.map((count) => (
          <button
            key={count || "any"}
            type="button"
            aria-pressed={value === count}
            onClick={() => onChange(count)}
            className={`min-h-10 min-w-12 rounded-lg border px-2 text-sm ${value === count ? "border-[#3368a0] bg-[#eaf1f7] font-semibold text-[#3368a0]" : "border-[#e1e7ed]"}`}
          >
            {count === "" ? "Bất kỳ" : `${count}+`}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FilterDialog({
  state,
  amenities,
  onClose,
  onApply,
}: {
  state: ListingSearchState;
  amenities: AmenityCatalogItem[];
  onClose: () => void;
  onApply: (next: ListingSearchState) => void;
}) {
  const [draft, setDraft] = useState(state);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleAmenity(key: string) {
    setDraft((current) => ({
      ...current,
      amenities: current.amenities.includes(key)
        ? current.amenities.filter((item) => item !== key)
        : [...current.amenities, key],
    }));
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-[#091216]/45 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-dialog-title"
        className="max-h-[min(760px,calc(100vh-4rem))] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="filter-dialog-title" className="inline-flex items-center gap-2 text-xl font-semibold text-[#091216]">
            <FilterIcon />
            Bộ lọc
          </h2>
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-full text-2xl" onClick={onClose} aria-label="Đóng bộ lọc">
            ×
          </button>
        </div>
        <div className="mt-6 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">
            Ngày nhận phòng
            <input type="date" value={draft.moveInDate} onChange={(event) => setDraft({ ...draft, moveInDate: event.target.value })} className="min-h-12 rounded-xl border border-[#e1e7ed] px-3 font-normal" />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">Chính sách</legend>
            <div className="flex flex-wrap gap-2">
              {petOptions.map((option) => (
                <button key={option.value || "any-pet"} type="button" aria-pressed={draft.pets === option.value} onClick={() => setDraft({ ...draft, pets: option.value })} className={`min-h-10 rounded-xl border px-3 text-sm ${draft.pets === option.value ? "border-[#3368a0] bg-[#eaf1f7] text-[#3368a0]" : "border-[#e1e7ed]"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">Tiện ích</legend>
            <div className="flex flex-wrap gap-2">
              {amenities.map((amenity) => {
                const selected = draft.amenities.includes(amenity.key);
                return (
                  <button key={amenity.key} type="button" aria-pressed={selected} onClick={() => toggleAmenity(amenity.key)} className={`min-h-10 rounded-xl border px-3 text-sm ${selected ? "border-[#3368a0] bg-[#eaf1f7] text-[#3368a0]" : "border-[#e1e7ed]"}`}>
                    {amenity.label_vi}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm font-semibold text-[#3368a0]"
            onClick={() => setDraft({ ...draft, moveInDate: "", pets: "", amenities: [] })}
          >
            Xóa bộ lọc
          </button>
          <button type="button" className="min-h-12 rounded-xl bg-[#3368a0] px-6 font-semibold text-white" onClick={() => onApply(draft)}>
            Xem kết quả
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function priceLabel(state: ListingSearchState): string {
  if (!state.minRent && !state.maxRent) return "Giá";
  const min = state.minRent ? formatMillions(state.minRent) : "";
  const max = state.maxRent ? formatMillions(state.maxRent) : "";
  if (min && max) return `${min} – ${max}`;
  if (min) return `Từ ${min}`;
  return `Đến ${max}`;
}

function roomsLabel(state: ListingSearchState): string {
  if (!state.bedrooms && !state.bathrooms) return "Phòng ngủ & phòng tắm";
  const beds = state.bedrooms ? `${state.bedrooms}+ PN` : "";
  const baths = state.bathrooms ? `${state.bathrooms}+ PT` : "";
  return [beds, baths].filter(Boolean).join(" · ");
}

function formatMillions(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 3 })} triệu`;
}

function vndToMillionsInput(vnd: string): string {
  if (vnd === "") return "";
  const value = Number(vnd) / 1_000_000;
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

function sanitizeMillions(raw: string): string {
  const text = raw.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [whole = "", ...rest] = text.split(",");
  if (rest.length === 0) return whole;
  return `${whole},${rest.join("").slice(0, 3)}`;
}

function millionsInputToVnd(text: string): string {
  if (text.trim() === "") return "";
  const millions = Number(text.replace(",", "."));
  if (!Number.isFinite(millions)) return "";
  return String(Math.round(millions * 1_000_000));
}
