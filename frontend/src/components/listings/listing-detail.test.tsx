import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingDetail } from "@/features/discovery/listings-api";
import { submitRentalRequest } from "@/lib/rental-requests-api";
import { ListingDetailView } from "./listing-detail";

const push = vi.fn();

vi.mock("@/lib/rental-requests-api", () => ({ submitRentalRequest: vi.fn() }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "tenant-1",
      name: "Mai Nguyễn",
      email: "mai@example.com",
      email_verified_at: null,
      phone: null,
      is_admin: false,
    },
    status: "authenticated",
  }),
}));

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
      smoking: "NOT_ALLOWED",
      rules: ["Không hút thuốc trong nhà"],
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
    vi.mocked(submitRentalRequest).mockReset();
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

    expect(within(dialog).getByText("Nhập số điện thoại.")).toBeTruthy();
    expect(within(dialog).getByText("Chọn ngày kết thúc mong muốn.")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("validates dates, retries the same operation after a network error and confirms the API result", async () => {
    const user = userEvent.setup();
    const send = vi.mocked(submitRentalRequest);
    send.mockRejectedValueOnce(new TypeError("Network error"))
      .mockResolvedValueOnce({ id: "request-1", status: "PENDING" });
    render(<ListingDetailView listing={listing} isSignedIn />);

    await user.click(screen.getByRole("button", { name: "Gửi yêu cầu thuê" }));
    const dialog = within(screen.getByRole("dialog", { name: "Gửi yêu cầu thuê" }));
    const submit = dialog.getByRole("button", { name: "Gửi yêu cầu thuê" });
    const name = dialog.getByRole("textbox", { name: /Họ và tên liên hệ/ });
    expect(name).toHaveProperty("value", "Mai Nguyễn");
    await user.clear(name);
    await user.type(name, "Lan Trần");
    const phone = dialog.getByRole("textbox", { name: /Số điện thoại/ });
    await user.click(phone);
    await user.paste("0901234567");
    expect(phone).toHaveProperty("value", "090 123 4567");
    const preferredUnit = dialog.getByRole("button", { name: /Căn ưu tiên/ });
    expect(preferredUnit.textContent).toContain("Không ưu tiên");
    expect(dialog.queryByRole("listbox")).toBeNull();

    await user.click(preferredUnit);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(preferredUnit.textContent).toContain("Phòng 1");
    expect(dialog.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(preferredUnit);

    await user.click(preferredUnit);
    await user.keyboard("{Escape}");
    expect(dialog.queryByRole("listbox")).toBeNull();
    expect(preferredUnit.textContent).toContain("Phòng 1");
    await user.type(dialog.getByRole("textbox", { name: "Lời nhắn (tùy chọn)" }), "Tôi muốn hẹn xem phòng.");

    async function pickDate(label: string, day: number, monthsAhead = 0) {
      await user.click(dialog.getByRole("button", { name: new RegExp(label) }));
      const calendar = within(screen.getByRole("dialog", { name: label }));
      for (let step = 0; step < monthsAhead; step += 1) {
        await user.click(calendar.getByRole("button", { name: "Tháng sau" }));
      }
      await user.click(calendar.getByRole("button", { name: new RegExp(`^${day} tháng`) }));
    }

    await pickDate("Ngày dọn vào mong muốn", 2);
    await pickDate("Ngày kết thúc mong muốn", 1);
    await user.click(submit);
    expect(dialog.getByText("Ngày kết thúc phải từ ngày dọn vào trở đi.")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();

    await pickDate("Ngày kết thúc mong muốn", 4);
    await user.click(submit);
    expect(dialog.getByText("3 ngày")).toBeTruthy();
    expect(dialog.getByText("Thời gian thuê phải ít nhất 3 tháng.")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();

    await pickDate("Ngày kết thúc mong muốn", 1, 3);
    await user.click(submit);
    expect(dialog.getByText("3 tháng")).toBeTruthy();
    expect(await dialog.findByText(/Chưa xác nhận được kết quả gửi/)).toBeTruthy();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      listing_id: listing.id,
      contact_name: "Lan Trần",
      contact_phone: "0901234567",
      preferred_unit_id: "unit-1",
      message: "Tôi muốn hẹn xem phòng.",
    }));

    await user.click(submit);
    const sent = await screen.findByRole("alertdialog", { name: "Đã gửi yêu cầu thuê" });
    expect(sent.textContent).toContain("Chủ nhà sẽ gọi vào số 090 123 4567.");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);

    await user.click(within(sent).getByRole("button", { name: "Xem yêu cầu" }));
    expect(push).toHaveBeenCalledWith("/tenant/requests");
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
