import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ListingSearchForm } from "./listing-search-form";

describe("listing search form", () => {
  it("builds a listings href for the typed location", async () => {
    const user = userEvent.setup();
    render(<ListingSearchForm />);

    await user.type(screen.getByLabelText("Địa điểm"), "Hải Châu");

    const href = screen.getByRole("link", { name: "Tìm nhà ngay!" }).getAttribute("href");
    const url = new URL(href ?? "", "http://localhost");
    expect(url.pathname).toBe("/listings");
    expect(url.searchParams.get("location")).toBe("Hải Châu");
  });
});
