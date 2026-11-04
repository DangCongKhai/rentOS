import { describe, expect, it } from "vitest";
import { addressMismatch } from "./basic-info-step";
import type { SelectedLocation } from "@/components/vietnam-location-picker";

const location: SelectedLocation = {
  city: "Cần Thơ",
  ward: "An Thạnh",
  cities: ["Cần Thơ", "Đồng Tháp", "Hà Nội"],
  wards: ["An Thạnh", "An Phước", "Tân Lộc"],
};

describe("addressMismatch", () => {
  it("requires both the selected city and ward in the address", () => {
    expect(addressMismatch("Can't wait for next month's BBQ!", location)).toBe(
      "Địa chỉ phải chứa An Thạnh và Cần Thơ.",
    );
    expect(addressMismatch("534 An Thạnh, Xin chào", location)).toBe(
      "Địa chỉ phải chứa An Thạnh và Cần Thơ.",
    );
    expect(addressMismatch("534 An Thạnh, Cần Thơ", location)).toBe("");
  });

  it("does not validate an empty street line", () => {
    expect(addressMismatch("   ", location)).toBe("");
  });
});
