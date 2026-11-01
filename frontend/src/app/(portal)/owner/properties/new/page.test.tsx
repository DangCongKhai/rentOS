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
    { key: "wifi", label: "Wi-Fi", scopes: ["unit"] },
  ]),
  getOwnerProperty: vi.fn(),
  updateOwnerUnit: vi.fn(),
  uploadOwnerMedia: vi.fn(),
}));

import NewOwnerPropertyPage from "./page";

describe("new owner property unit preview", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("lets an owner edit terms and amenity details per generated unit", async () => {
    const user = userEvent.setup();
    render(<NewOwnerPropertyPage />);

    await user.click(screen.getByRole("button", { name: /Hình thức thuê và phân bổ căn/ }));
    await user.click(screen.getByRole("radio", { name: /Từng căn riêng lẻ/ }));
    await user.clear(screen.getByLabelText("Số lượng"));
    await user.type(screen.getByLabelText("Số lượng"), "2");
    await user.click(screen.getByRole("button", { name: /Giá thuê và điều khoản/ }));

    expect(document.querySelector('input[name="new_0_rent"]')).not.toBeNull();
    expect(document.querySelector('input[name="new_1_rent"]')).not.toBeNull();
    expect(document.querySelector('input[name="new_0_amenity:wifi"]')).not.toBeNull();
    expect(document.querySelector('input[name="new_0_details:wifi"]')).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Tên căn 1"), { target: { value: "Phòng A" } });
    expect((screen.getByLabelText("Tên căn 1") as HTMLInputElement).value).toBe("Phòng A");
  });
});
