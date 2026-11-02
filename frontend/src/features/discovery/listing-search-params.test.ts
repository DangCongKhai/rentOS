import { describe, expect, it } from "vitest";
import {
  ListingSearchValidationError,
  clearLocation,
  parseListingSearchParams,
  toListingSearchParams,
} from "./listing-search-params";

describe("listing search params", () => {
  it("round-trips location, move-in date, price, chips, and page", () => {
    const original = new URLSearchParams({
      location: "Hải Châu",
      move_in_date: "2026-12-01",
      min_rent: "2000000",
      max_rent: "5000000",
      unit_kind: "STUDIO",
      bedrooms: "1",
      occupants: "2",
      pets: "ALLOWED",
      page: "2",
    });
    original.append("amenities", "washing_machine");
    original.append("amenities", "parking");

    const parsed = parseListingSearchParams(original);
    const encoded = toListingSearchParams(parsed);

    expect(parseListingSearchParams(encoded)).toEqual(parsed);
    expect(encoded.get("location")).toBe("Hải Châu");
    expect(encoded.getAll("amenities[]")).toEqual(["washing_machine", "parking"]);
  });

  it("omits a blank location and clears only that filter", () => {
    const params = new URLSearchParams({
      location: "Hải Châu",
      max_rent: "4000000",
      pets: "ALLOWED",
      page: "3",
    });
    params.append("amenities", "wifi");

    const cleared = clearLocation(params);

    expect(cleared.get("location")).toBeNull();
    expect(cleared.get("max_rent")).toBe("4000000");
    expect(cleared.get("pets")).toBe("ALLOWED");
    expect(cleared.getAll("amenities")).toEqual(["wifi"]);
    expect(cleared.get("page")).toBe("1");
    expect(parseListingSearchParams(new URLSearchParams("location=   ")).location).toBe("");
    expect(toListingSearchParams(parseListingSearchParams(new URLSearchParams("location=   "))).has("location")).toBe(false);
  });

  it("rejects an unparseable move-in date", () => {
    expect(() => parseListingSearchParams(new URLSearchParams("move_in_date=not-a-date"))).toThrow(ListingSearchValidationError);
  });
});
