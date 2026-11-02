import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UnavailableListing } from "./unavailable-listing";

describe("unavailable listing", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the unavailable copy without a hidden title", () => {
    render(<UnavailableListing />);

    expect(screen.getByRole("heading", { name: "Bài đăng này hiện không khả dụng" })).toBeTruthy();
    expect(screen.queryByText("Tiêu đề bí mật bị ẩn")).toBeNull();
  });
});
