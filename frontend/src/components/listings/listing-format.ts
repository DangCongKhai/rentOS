import type { ListingDetail, PublicAmenity, PublicMedia, PublicUnit } from "@/features/discovery/listings-api";

export const kindLabels: Record<string, string> = {
  ROOM: "Phòng",
  STUDIO: "Studio",
  APARTMENT: "Căn hộ",
  HOUSE: "Nhà",
};

export const propertyLabels: Record<string, string> = {
  HOUSE: "Nhà",
  APARTMENT: "Căn hộ",
  APARTMENT_BUILDING: "Tòa nhà",
};

export const petLabels: Record<string, string> = {
  ALLOWED: "Cho phép",
  ASK_OWNER: "Hỏi chủ nhà",
  NOT_ALLOWED: "Không cho phép",
};

export type Slide = {
  key: string;
  url: string;
  label: string;
};

export function photoSlides(listing: ListingDetail): Slide[] {
  const shared = listing.gallery.map((photo) => slide(photo, "Ảnh chung"));
  const units = listing.units.flatMap((unit) => unit.photos.map((photo) => slide(photo, unit.label)));
  return [...shared, ...units];
}

function slide(photo: PublicMedia, label: string): Slide {
  return { key: photo.id, url: photo.url, label: photo.caption || label };
}

export function propertyBadge(listing: ListingDetail): string {
  const kinds = new Set(listing.units.map((unit) => unit.unit_kind));
  if (listing.property.property_type === "APARTMENT_BUILDING" && kinds.size === 1 && kinds.has("STUDIO")) {
    return "Tòa nhà studio";
  }
  return propertyLabels[listing.property.property_type] ?? listing.property.property_type;
}

export function placeLine(listing: ListingDetail): string {
  const ward = listing.property.ward?.trim() ?? "";
  const wardLabel = ward === "" ? "" : /^phường\s/i.test(ward) ? ward : `Phường ${ward}`;
  return [wardLabel || listing.property.address_line, listing.property.city].filter(Boolean).join(", ");
}

export function rentBounds(units: PublicUnit[]): { min: number; max: number } | null {
  const rents = units.map((unit) => Number(unit.advertised_monthly_rent)).filter(Number.isFinite);
  if (rents.length === 0) return null;
  return { min: Math.min(...rents), max: Math.max(...rents) };
}

export function minimumMonths(units: PublicUnit[]): number {
  const months = units.map((unit) => unit.minimum_rental_months);
  return months.length === 0 ? 0 : Math.min(...months);
}

export function areaLabel(units: PublicUnit[]): string {
  const areas = units.map((unit) => Number(unit.area_m2)).filter(Number.isFinite);
  if (areas.length === 0) return "—";
  const min = Math.min(...areas);
  const max = Math.max(...areas);
  return min === max ? `${meters(min)} m²` : `${meters(min)}–${meters(max)} m²`;
}

export function bathLabel(units: PublicUnit[]): string {
  return units.some((unit) => Number(unit.bathrooms) >= 1) ? "WC riêng" : "WC chung";
}

export function unitKindLabel(units: PublicUnit[]): string {
  const kinds = [...new Set(units.map((unit) => unit.unit_kind))];
  if (kinds.length === 1) return kindLabels[kinds[0]] ?? kinds[0];
  return "Nhiều loại";
}

export function uniqueUnitAmenities(units: PublicUnit[]): PublicAmenity[] {
  const seen = new Set<string>();
  const amenities: PublicAmenity[] = [];
  for (const unit of units) {
    for (const amenity of unit.amenities) {
      if (seen.has(amenity.key)) continue;
      seen.add(amenity.key);
      amenities.push(amenity);
    }
  }
  return amenities;
}

export function extraAmenities(listing: ListingDetail): string[] {
  return [
    ...listing.property.custom_amenities,
    ...listing.units.flatMap((unit) => unit.custom_amenities),
  ].filter((item, index, all) => all.indexOf(item) === index);
}

export function depositCopy(units: PublicUnit[]): string {
  const deposits = [...new Set(units.map((unit) => Number(unit.deposit)).filter(Number.isFinite))];
  if (deposits.length === 0) return "Theo từng căn";
  if (deposits.length === 1) return `${dong(deposits[0])}, theo từng căn`;
  return `${amount(Math.min(...deposits))} – ${dong(Math.max(...deposits))}, theo từng căn`;
}

export function petCopy(units: PublicUnit[]): string {
  const labels = [...new Set(units.map((unit) => petLabels[unit.pets ?? ""] ?? null).filter((label): label is string => label !== null))];
  if (labels.length === 0) return "Hỏi chủ nhà";
  return labels.join(" · ");
}

export function ruleTitle(rule: string): string {
  return /hút thuốc/i.test(rule) ? "Hút thuốc" : "Nội quy chung";
}

export function ownerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(-2).map((part) => Array.from(part)[0] ?? "").join("");
  return letters.toLocaleUpperCase("vi") || "CN";
}

export function meters(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

export function amount(value: number): string {
  return value.toLocaleString("vi-VN");
}

export function dong(value: number): string {
  return `${amount(value)} ₫`;
}
