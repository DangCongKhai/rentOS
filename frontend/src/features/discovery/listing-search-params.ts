export class ListingSearchValidationError extends Error {
  constructor(message = "Bộ lọc tìm kiếm không hợp lệ.") {
    super(message);
    this.name = "ListingSearchValidationError";
  }
}

export type ListingSearchState = {
  location: string;
  moveInDate: string;
  minRent: string;
  maxRent: string;
  unitKind: string;
  bedrooms: string;
  bathrooms: string;
  occupants: string;
  amenities: string[];
  pets: string;
  page: number;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseListingSearchParams(params: URLSearchParams): ListingSearchState {
  const moveInDate = params.get("move_in_date") ?? "";
  if (moveInDate !== "" && !isIsoDate(moveInDate)) {
    throw new ListingSearchValidationError("Ngày nhận phòng không hợp lệ.");
  }

  const page = Number(params.get("page") ?? "1");

  return {
    location: (params.get("location") ?? "").trim().replace(/\s+/g, " "),
    moveInDate,
    minRent: params.get("min_rent") ?? "",
    maxRent: params.get("max_rent") ?? "",
    unitKind: params.get("unit_kind") ?? "",
    bedrooms: params.get("bedrooms") ?? "",
    bathrooms: params.get("bathrooms") ?? "",
    occupants: params.get("occupants") ?? "",
    amenities: [...params.getAll("amenities"), ...params.getAll("amenities[]")].filter((key) => key !== ""),
    pets: params.get("pets") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function toListingSearchParams(state: ListingSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const location = state.location.trim().replace(/\s+/g, " ");
  if (location !== "") params.set("location", location);
  if (state.moveInDate !== "") params.set("move_in_date", state.moveInDate);
  if (state.minRent !== "") params.set("min_rent", state.minRent);
  if (state.maxRent !== "") params.set("max_rent", state.maxRent);
  if (state.unitKind !== "") params.set("unit_kind", state.unitKind);
  if (state.bedrooms !== "") params.set("bedrooms", state.bedrooms);
  if (state.bathrooms !== "") params.set("bathrooms", state.bathrooms);
  if (state.occupants !== "") params.set("occupants", state.occupants);
  if (state.pets !== "") params.set("pets", state.pets);
  for (const amenity of state.amenities) params.append("amenities[]", amenity);
  if (state.page > 1) params.set("page", String(state.page));
  return params;
}

export function clearLocation(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("location");
  next.set("page", "1");
  return next;
}
