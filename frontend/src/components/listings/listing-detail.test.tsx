import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingDetail } from "@/features/discovery/listings-api";
import { ListingDetailView } from "./listing-detail";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

const listing: ListingDetail = {
  id: "listing-1",
  title: "Studio full nội thất",
  description: "Mô tả công khai",
  availability_label: "Trống từ 02/05/2027",
  available_unit_count: 0,
  gallery: [
    { id: "photo-1", caption: "Mặt ngoài", sort_order: 0, url: "/photos/outside.webp" },
    { id: "photo-2", caption: "Phòng khách", sort_order: 1, url: "/photos/living.webp" },
  ],
  property: {
    name: "Nhà Hải Châu",
    property_type: "APARTMENT",
    address_line: "12 Trần Phú",
    ward: "Hải Châu",
    city: "Đà Nẵng",
    description: "Nhà cho thuê",
    shared_rules: ["Không hút thuốc trong nhà"],
    shared_amenities: [{ key: "laundry", label_vi: "Giặt là chung", details: "Tầng trệt" }],
    custom_amenities: [],
  },
  owner: { name: "Quoc Huy Le" },
  units: [
    {
      id: "unit-1",
      label: "Phòng 1",
      unit_kind: "STUDIO",
      description: "Phòng",
      area_m2: "28.00",
      bedrooms: 1,
      bathrooms: "1.00",
      advertised_monthly_rent: "3800000",
      deposit: "3800000",
      minimum_rental_months: 3,
      max_occupants: 2,
      availability_label: "Đã được giữ/đặt. Trống từ 02/05/2027",
      available_from: "2027-05-02",
      available_until: null,
      held_start: "2026-11-01",
      held_end: "2027-05-01",
      pets: "NOT_ALLOWED",
      amenities: [],
      custom_amenities: ["Máy giặt riêng"],
      photos: [],
    },
  ],
};

describe("listing detail", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    push.mockReset();
  });

  it("separates shared laundry from an in-unit washing machine and keeps a held unit", async () => {
    const user = userEvent.setup();
    render(<ListingDetailView listing={listing} isSignedIn />);

    const shared = screen.getByRole("region", { name: "Tiện ích chung" });
    expect(shared.textContent).toContain("Giặt là chung");
    expect(screen.getByText("Đã được giữ/đặt. Trống từ 02/05/2027")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Nội quy đang quảng cáo" }).textContent).toContain("Không hút thuốc trong nhà");
    expect(screen.getByText("Quoc Huy Le")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Phòng 1/ }));

    const dialog = screen.getByRole("dialog", { name: "Chi tiết Phòng 1" });
    const unitAmenities = within(dialog).getByRole("region", { name: "Tiện ích trong căn Phòng 1" });
    expect(unitAmenities.textContent).not.toContain("Máy giặt");
    expect(within(dialog).getByText(/Máy giặt riêng/)).toBeTruthy();
  });

  it("opens the request form only after the button is clicked", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ListingDetailView listing={listing} isSignedIn />);

    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Gửi yêu cầu thuê" }));
    const dialog = screen.getByRole("dialog", { name: "Gửi yêu cầu thuê" });
    await user.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu thuê" }));

    expect(within(dialog).getByRole("alert").textContent).toContain("Nhập số điện thoại.");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("sends a guest to login from the request form", async () => {
    const user = userEvent.setup();
    render(<ListingDetailView listing={listing} isSignedIn={false} />);

    await user.click(screen.getByRole("button", { name: "Gửi yêu cầu thuê" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Gửi yêu cầu thuê" }));

    expect(push).toHaveBeenCalledWith("/login");
  });

  it("opens the report form for a signed-in user and keeps it closed until then", async () => {
    const user = userEvent.setup();
    render(<ListingDetailView listing={listing} isSignedIn />);

    expect(screen.queryByRole("dialog", { name: "Báo cáo tin đăng này" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Báo cáo" }));
    const dialog = screen.getByRole("dialog", { name: "Báo cáo tin đăng này" });
    await user.click(within(dialog).getByRole("button", { name: "Gửi báo cáo" }));

    expect(within(dialog).getByRole("alert").textContent).toContain("Chọn lý do báo cáo.");

    await user.click(within(dialog).getByRole("radio", { name: /Sai lệch thông tin/ }));
    await user.type(within(dialog).getByRole("textbox", { name: "Mô tả (bắt buộc)" }), "Ảnh không giống căn thật.");
    await user.click(within(dialog).getByRole("button", { name: "Gửi báo cáo" }));

    expect(within(dialog).getByRole("status").textContent).toContain("Chưa gửi báo cáo.");
  });

  it("asks a guest to sign in before reporting", () => {
    render(<ListingDetailView listing={listing} isSignedIn={false} />);

    const link = screen.getByRole("link", { name: "Đăng nhập để báo cáo tin đăng này" });
    expect(link.getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("button", { name: "Báo cáo" })).toBeNull();
  });

  it("opens a scrollable gallery of every photo", async () => {
    const user = userEvent.setup();
    render(<ListingDetailView listing={listing} isSignedIn />);

    await user.click(screen.getByRole("button", { name: "Xem tất cả 2 ảnh" }));

    const dialog = screen.getByRole("dialog", { name: "Tất cả ảnh" });
    expect(within(dialog).getAllByRole("img")).toHaveLength(2);
  });
});
