import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ListingCardView } from "./listing-card";
import type { ListingCard } from "./listings-api";

afterEach(cleanup);

function listing(imageUrls: string[]): ListingCard {
  return {
    id: "listing-1",
    title: "Studio full nội thất gần biển Mỹ Khê",
    availability_label: "Còn trống đến 01/06/2027",
    available_unit_count: 3,
    rent_min: "3800000",
    rent_max: "3800000",
    minimum_rental_months: 3,
    cover_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    property: {
      name: "Nhà Phước Mỹ",
      property_type: "HOUSE",
      ward: "Phước Mỹ",
      city: "Sơn Trà",
    },
  };
}

function photoSrc(): string {
  const image = screen.getByRole("img", { name: "Studio full nội thất gần biển Mỹ Khê" });
  return decodeURIComponent(image.getAttribute("src") ?? "");
}

describe("listing card gallery", () => {
  it("steps through every photo and shows the current position", async () => {
    const user = userEvent.setup();
    render(
      <ListingCardView
        listing={listing(["/photos/house.webp", "/photos/living.webp", "/photos/kitchen.webp", "/photos/bath.webp"])}
        href="/listings/listing-1"
      />,
    );

    expect(photoSrc()).toContain("/photos/house.webp");
    expect(screen.getByText("1/4")).toBeTruthy();
    expect(screen.getByText("3 căn còn trống")).toBeTruthy();
    expect(screen.queryByText("Còn trống đến 01/06/2027")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Ảnh sau" }));

    expect(photoSrc()).toContain("/photos/living.webp");
    expect(screen.getByText("2/4")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ảnh trước" }));

    expect(photoSrc()).toContain("/photos/house.webp");
    expect(screen.getByText("1/4")).toBeTruthy();
  });

  it("advances one photo for every click in the same turn", () => {
    render(
      <ListingCardView
        listing={listing(["/photos/house.webp", "/photos/living.webp", "/photos/kitchen.webp", "/photos/bath.webp"])}
        href="/listings/listing-1"
      />,
    );

    const next = screen.getByRole("button", { name: "Ảnh sau" });
    act(() => {
      next.click();
      next.click();
      next.click();
    });

    expect(screen.getByText("4/4")).toBeTruthy();
    expect(photoSrc()).toContain("/photos/bath.webp");
  });

  it("hides the controls when a listing has one photo", () => {
    render(<ListingCardView listing={listing(["/photos/only.webp"])} href="/listings/listing-1" />);

    expect(photoSrc()).toContain("/photos/only.webp");
    expect(screen.queryByRole("button", { name: "Ảnh sau" })).toBeNull();
    expect(screen.queryByText("1/1")).toBeNull();
  });
});
