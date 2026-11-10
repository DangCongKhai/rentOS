import { request } from "./auth-api";
import type { ListingCard } from "@/features/discovery/listings-api";

const path = "/api/v1/favourite-properties";

export type FavouritePage = {
  items: { property_id: string; listing: ListingCard | null }[];
  page: number;
  last_page: number;
  total: number;
};

export function getFavouriteIds(accountId: string, signal: AbortSignal) {
  return request<{ ids: string[]; count: number }>(path + "/ids", { headers: { "X-Favourites-Account": accountId }, signal });
}

export function getFavouritePage(accountId: string, params: URLSearchParams, signal: AbortSignal) {
  return request<FavouritePage>(path + "?" + params.toString(), { headers: { "X-Favourites-Account": accountId }, signal });
}

export function setFavourite(accountId: string, propertyId: string, saved: boolean, signal: AbortSignal) {
  return request<void>(path + "/" + encodeURIComponent(propertyId), {
    method: saved ? "PUT" : "DELETE",
    headers: { "X-Favourites-Account": accountId },
    signal,
  });
}
