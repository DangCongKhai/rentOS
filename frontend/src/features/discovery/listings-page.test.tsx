import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingSearchResponse } from "./listings-api";

const replace = vi.fn();
let query = "location=H%E1%BA%A3i%20Ch%C3%A2u&max_rent=4000000&amenities=wifi&page=2";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/listings",
  useSearchParams: () => new URLSearchParams(query),
}));

const requests: Array<{ resolve: (value: ListingSearchResponse) => void; signal: AbortSignal }> = [];

vi.mock("./listings-api", () => ({
  fetchAmenities: () => Promise.resolve({
    data: [
      { key: "wifi", scope: "PROPERTY", label_vi: "Wifi" },
      { key: "washing_machine", scope: "UNIT", label_vi: "Máy giặt" },
    ],
  }),
  fetchListings: (_params: URLSearchParams, signal: AbortSignal) =>
    new Promise<ListingSearchResponse>((resolve) => {
      requests.push({ resolve, signal });
    }),
}));

import { ListingsBrowser, paginationItems } from "./listings-browser";

function card(title: string, label: string): ListingSearchResponse {
  return {
    data: [
      {
        id: "listing-1",
        title,
        availability_label: label,
        available_unit_count: 0,
        rent_min: "3800000",
        rent_max: "4500000",
        minimum_rental_months: 3,
        cover_url: null,
        image_urls: [],
        property: {
          name: "Nhà Hải Châu",
          property_type: "APARTMENT",
          ward: "Hải Châu",
          city: "Đà Nẵng",
        },
      },
    ],
    meta: { current_page: 1, per_page: 12, total: 1, last_page: 1 },
  };
}

describe("pagination", () => {
  it("shows every page when they all fit", () => {
    expect(paginationItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps the current page between its neighbors and the last page", () => {
    expect(paginationItems(4, 274)).toEqual([1, 2, 3, 4, 5, "gap", 274]);
    expect(paginationItems(10, 17)).toEqual([1, "gap", 9, 10, 11, "gap", 17]);
    expect(paginationItems(16, 17)).toEqual([1, "gap", 13, 14, 15, 16, 17]);
  });
});

describe("listings page", () => {
  beforeEach(() => {
    replace.mockReset();
    requests.length = 0;
    query = "location=H%E1%BA%A3i%20Ch%C3%A2u&max_rent=4000000&amenities=wifi&page=2";
  });

  it("clears only the location and keeps the other filters", async () => {
    const user = userEvent.setup();
    render(<ListingsBrowser />);
    requests[0]?.resolve(card("Studio", "Còn trống"));

    await user.click(await screen.findByRole("button", { name: "Xóa địa điểm" }));

    const href = String(replace.mock.calls[0]?.[0]);
    const next = new URL(href, "http://localhost").searchParams;
    expect(next.get("location")).toBeNull();
    expect(next.get("max_rent")).toBe("4000000");
    expect(next.getAll("amenities")).toEqual(["wifi"]);
    expect(next.get("page")).toBe("1");
  });

  it("keeps an occupied listing and shows when it becomes free", async () => {
    render(<ListingsBrowser />);
    requests[0]?.resolve(card("Studio full nội thất", "Trống từ 02/05/2027"));

    expect(await screen.findByText("Trống từ 02/05/2027")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Studio full nội thất/ })).toBeTruthy();
  });

  it("ignores a slower response after a newer search starts", async () => {
    const view = render(<ListingsBrowser />);
    const first = requests[0];
    query = "location=S%C6%A1n%20Tr%C3%A0";
    view.rerender(<ListingsBrowser />);
    const second = requests[1];

    second?.resolve(card("Tin mới", "Còn trống"));
    expect(await screen.findByText("Tin mới")).toBeTruthy();

    first?.resolve(card("Tin cũ", "Trống từ 02/05/2027"));
    await waitFor(() => {
      expect(screen.queryByText("Tin cũ")).toBeNull();
    });
    expect(screen.getByText("Tin mới")).toBeTruthy();
  });
});
