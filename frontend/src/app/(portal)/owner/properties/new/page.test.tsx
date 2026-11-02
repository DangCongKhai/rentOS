import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/lib/auth-api", () => ({
  ApiError: class ApiError extends Error {},
  createOwnerProperty: vi.fn(),
  createOwnerUnitBatch: vi.fn(),
  getAmenityCatalog: vi.fn().mockResolvedValue([
    { key: "wifi", label: "Wi-Fi", scopes: ["shared", "unit"] },
    { key: "aircon", label: "Điều hòa", scopes: ["unit"] },
  ]),
  getOwnerProperty: vi.fn(),
  updateOwnerUnit: vi.fn(),
  uploadOwnerMedia: vi.fn(),
}));

import NewOwnerPropertyPage from "./page";

describe("new owner property wizard", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("uses the shared five-step flow and hides property amenities from unit choices", async () => {
    const user = userEvent.setup();
    render(<NewOwnerPropertyPage />);

    await user.click(screen.getByRole("button", { name: "Hình thức thuê" }));
    await user.click(screen.getByRole("radio", { name: /Cho thuê từng căn\/phòng/ }));
    await user.clear(screen.getByLabelText("Số lượng"));
    await user.type(screen.getByLabelText("Số lượng"), "2");
    fireEvent.change(screen.getByLabelText("Tên căn 1"), { target: { value: "Phòng A" } });

    expect(document.querySelector('input[name="new_0_rent"]')).not.toBeNull();
    expect(document.querySelector('input[name="new_1_rent"]')).not.toBeNull();
    expect((screen.getByLabelText("Tên căn 1") as HTMLInputElement).value).toBe("Phòng A");

    await user.click(screen.getByRole("button", { name: "Tiện ích chung" }));
    await user.click(document.querySelector('input[name="amenity:wifi"]')!);
    await user.click(screen.getByRole("tab", { name: "Trong căn/phòng" }));

    expect(document.querySelector('input[name="unit_amenity:wifi"]')).toBeNull();
    expect(document.querySelector('input[name="unit_amenity:aircon"]')).not.toBeNull();
  });
});
