import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/auth-api";
import {
  getTenantRentalRequest,
  getTenantRentalRequests,
  withdrawTenantRentalRequest,
  type TenantRentalRequestDetail,
} from "@/lib/rental-requests-api";
import { TenantRequestsScreen } from "./tenant-requests-screen";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "tenant-1" }, status: "authenticated" }),
}));
vi.mock("@/lib/rental-requests-api", () => ({
  getTenantRentalRequest: vi.fn(),
  getTenantRentalRequests: vi.fn(),
  withdrawTenantRentalRequest: vi.fn(),
}));

const pending: TenantRentalRequestDetail = {
  id: "request-1",
  title: "Studio gần biển Mỹ Khê",
  ward: "Phước Mỹ",
  city: "Đà Nẵng",
  desired_move_in_date: "2027-01-01",
  desired_end_date: "2027-03-31",
  preferred_unit: "S201",
  status: "PENDING",
  outcome_reason: null,
  updated_at: "2026-11-06T08:00:00.000000+07:00",
  created_at: "2026-11-06T08:00:00+07:00",
  closed_at: null,
  tenancy: null,
  contact_name: "Nguyễn Thị Mai",
  contact_phone: "0901234567",
  message: "Tôi muốn hẹn xem nhà.",
};

describe("tenant rental requests", () => {
  const dialogPrototype = HTMLDialogElement.prototype;
  const needsDialogMethods = typeof dialogPrototype.showModal !== "function";

  beforeAll(() => {
    if (needsDialogMethods) {
      Object.defineProperties(dialogPrototype, {
        showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true; } },
        close: { configurable: true, value(this: HTMLDialogElement) { this.open = false; } },
      });
    }
  });
  afterAll(() => {
    if (needsDialogMethods) {
      Reflect.deleteProperty(dialogPrototype, "showModal");
      Reflect.deleteProperty(dialogPrototype, "close");
    }
  });
  afterEach(cleanup);
  beforeEach(() => vi.resetAllMocks());

  it("withdraws from the list and refreshes the closed tab and counts", async () => {
    const user = userEvent.setup();
    const list = vi.mocked(getTenantRentalRequests);
    list.mockResolvedValueOnce({
      items: [pending], counts: { all: 1, pending: 1, accepted: 0, closed: 0 }, page: 1, last_page: 1,
    }).mockResolvedValueOnce({
      items: [{ ...pending, status: "WITHDRAWN" }],
      counts: { all: 1, pending: 0, accepted: 0, closed: 1 }, page: 1, last_page: 1,
    });
    vi.mocked(withdrawTenantRentalRequest).mockResolvedValue(undefined);
    render(<TenantRequestsScreen />);

    await user.click(await screen.findByRole("button", { name: "Rút yêu cầu" }));
    const dialog = within(screen.getByRole("dialog", { name: "Rút yêu cầu thuê?" }));
    await user.type(dialog.getByRole("textbox", { name: /Lý do/ }), "Đổi kế hoạch");
    await user.click(dialog.getByRole("button", { name: "Xác nhận rút yêu cầu" }));

    expect(await screen.findByText("Đã rút lại")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Đã đóng/ }).getAttribute("aria-pressed")).toBe("true");
    expect(withdrawTenantRentalRequest).toHaveBeenCalledWith(pending.id, expect.objectContaining({
      reason: "Đổi kế hoạch", expected_updated_at: pending.updated_at,
    }));
    expect(list).toHaveBeenLastCalledWith("closed", 1, expect.any(AbortSignal));
    expect(screen.queryByRole("button", { name: "Rút yêu cầu" })).toBeNull();
  });

  it("refreshes a conflicting detail and shows the separate contract confirmation state", async () => {
    const user = userEvent.setup();
    vi.mocked(getTenantRentalRequest).mockResolvedValueOnce(pending).mockResolvedValueOnce({
      ...pending, status: "ACCEPTED",
      tenancy: { id: "tenancy-1", status: "PENDING_CONFIRMATION", confirmation_expires_at: null },
    });
    vi.mocked(withdrawTenantRentalRequest).mockRejectedValue(new ApiError(409, "Đã có đề xuất"));
    render(<TenantRequestsScreen requestId={pending.id} />);

    expect(await screen.findByText(pending.contact_name)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Rút yêu cầu" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận rút yêu cầu" }));

    expect(await screen.findByText("Đang chờ bạn xác nhận")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Yêu cầu đã thay đổi");
    expect(screen.getByRole("link", { name: "Căn hộ và hợp đồng" }).getAttribute("href")).toBe("/tenant/contracts");
    expect(screen.queryByRole("button", { name: "Rút yêu cầu" })).toBeNull();
  });
});
