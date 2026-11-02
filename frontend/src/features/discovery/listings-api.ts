import { ListingSearchValidationError } from "./listing-search-params";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ListingUnavailableError extends Error {
  constructor() {
    super("Tin đăng không khả dụng");
    this.name = "ListingUnavailableError";
  }
}

export class ListingsRequestError extends Error {
  status: number;

  constructor(status: number) {
    super("Không tải được danh sách.");
    this.name = "ListingsRequestError";
    this.status = status;
  }
}

export type ListingCard = {
  id: string;
  title: string;
  availability_label: string;
  available_unit_count: number;
  rent_min: string;
  rent_max: string;
  minimum_rental_months: number;
  cover_url: string | null;
  image_urls: string[];
  property: {
    name: string;
    property_type: string;
    ward: string | null;
    city: string;
  };
};

export type ListingSearchResponse = {
  data: ListingCard[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    result_label?: string;
  };
};

export type PublicMedia = {
  id: string;
  caption: string | null;
  sort_order: number;
  url: string;
};

export type PublicAmenity = {
  key: string;
  label_vi: string;
  details: string | null;
};

export type PublicUnit = {
  id: string;
  label: string;
  unit_kind: string;
  description: string | null;
  area_m2: string;
  bedrooms: number;
  bathrooms: string;
  advertised_monthly_rent: string;
  deposit: string;
  minimum_rental_months: number;
  max_occupants: number;
  availability_label: string;
  available_from: string | null;
  available_until: string | null;
  held_start: string | null;
  held_end: string | null;
  pets: string | null;
  amenities: PublicAmenity[];
  custom_amenities: string[];
  photos: PublicMedia[];
};

export type ListingDetail = {
  id: string;
  title: string;
  description: string;
  availability_label: string;
  available_unit_count: number;
  gallery: PublicMedia[];
  property: {
    name: string;
    property_type: string;
    address_line: string;
    ward: string | null;
    city: string;
    description: string;
    shared_rules: string[];
    shared_amenities: PublicAmenity[];
    custom_amenities: string[];
  };
  owner: {
    name: string | null;
  };
  units: PublicUnit[];
};

export type AmenityCatalogItem = {
  key: string;
  scope: "PROPERTY" | "UNIT";
  label_vi: string;
};

async function publicGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (response.status === 422) {
    throw new ListingSearchValidationError();
  }

  if (response.status === 404) {
    throw new ListingUnavailableError();
  }

  if (!response.ok) {
    throw new ListingsRequestError(response.status);
  }

  return (await response.json()) as T;
}

export function fetchListings(params: URLSearchParams, signal?: AbortSignal): Promise<ListingSearchResponse> {
  const query = params.toString();
  return publicGet<ListingSearchResponse>(`/api/v1/listings${query ? `?${query}` : ""}`, signal);
}

export function fetchListing(id: string, signal?: AbortSignal): Promise<{ data: ListingDetail }> {
  return publicGet<{ data: ListingDetail }>(`/api/v1/listings/${id}`, signal);
}

export function fetchAmenities(signal?: AbortSignal): Promise<{ data: AmenityCatalogItem[] }> {
  return publicGet<{ data: AmenityCatalogItem[] }>("/api/v1/amenities", signal);
}
