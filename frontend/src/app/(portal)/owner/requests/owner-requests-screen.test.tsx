import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/auth-api";
import { getOwnerRentalRequest, rejectOwnerRentalRequest, type OwnerRentalRequestDetail } from "@/lib/rental-requests-api";
import { OwnerRequestsScreen } from "./owner-requests-screen";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "owner-1", name: "Linh" }, status: "authenticated" }),
}));
vi.mock("@/lib/rental-requests-api", () => ({
  getOwnerRentalRequest: vi.fn(),
  getOwnerRentalRequests: vi.fn(),
  rejectOwnerRentalRequest: vi.fn(),
}));

const pending: OwnerRentalRequestDetail = {
  id: "request-1",
  contact_name: "Nguyễn Thị Mai",
  contact_phone: "0905123456",
  title: "Studio gần biển Mỹ Khê",
  desired_move_in_date: "2027-01-01",
  desired_end_date: "2027-03-31",
  preferred_unit: "S201",
  preferred_unit_available: true,
  alternative_units: [{ id: "unit-2", label: "S202", monthly_rent: "3800000" }],
  status: "PENDING",
  outcome_reason: null,
  created_at: "2026-11-06T08:00:00+07:00",
  closed_at: null,
  updated_at: "2026-11-06T08:00:00.000000+07:00",
  message: "Tôi muốn hẹn xem nhà.",
};

describe("owner rental requests", () => {
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

  it("requires a reason, then confirms rejection and displays the result", async () => {
    const user = userEvent.setup();
    const reject = vi.mocked(rejectOwnerRentalRequest);
    vi.mocked(getOwnerRentalRequest).mockResolvedValueOnce(pending).mockResolvedValueOnce({
      ...pending, status: "REJECTED", outcome_reason: "Không có căn phù hợp.",
    });
    reject.mockResolvedValue(undefined);
    render(<OwnerRequestsScreen requestId={pending.id} />);

    await user.click(await screen.findByRole("button", { name: "Từ chối" }));
    const dialog = within(screen.getByRole("dialog", { name: "Từ chối yêu cầu thuê" }));
    const confirm = dialog.getByRole("button", { name: "Xác nhận từ chối" });
    await user.click(confirm);
    expect(dialog.getByRole("alert").textContent).toContain("Nhập lý do");
    expect(reject).not.toHaveBeenCalled();
    await user.type(dialog.getByRole("textbox", { name: /Lý do từ chối/ }), " Không có căn phù hợp. ");
    await user.click(confirm);

    expect(await screen.findByText("Không có căn phù hợp.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Đã từ chối yêu cầu thuê.");
    expect(reject).toHaveBeenCalledWith(pending.id, expect.objectContaining({
      reason: "Không có căn phù hợp.", expected_updated_at: pending.updated_at,
    }));
    expect(screen.queryByRole("button", { name: "Từ chối" })).toBeNull();
  });

  it("reloads the current state if the tenant has already withdrawn", async () => {
    const user = userEvent.setup();
    vi.mocked(getOwnerRentalRequest).mockResolvedValueOnce(pending).mockResolvedValueOnce({
      ...pending, status: "WITHDRAWN",
    });
    vi.mocked(rejectOwnerRentalRequest).mockRejectedValue(new ApiError(409, "Yêu cầu đã thay đổi."));
    render(<OwnerRequestsScreen requestId={pending.id} />);

    await user.click(await screen.findByRole("button", { name: "Từ chối" }));
    const dialog = within(screen.getByRole("dialog", { name: "Từ chối yêu cầu thuê" }));
    await user.type(dialog.getByRole("textbox"), "Không có căn phù hợp.");
    await user.click(dialog.getByRole("button", { name: "Xác nhận từ chối" }));

    expect((await screen.findAllByText("Đã rút lại")).length).toBeGreaterThan(0);
    expect(screen.getByRole("alert").textContent).toContain("Yêu cầu đã thay đổi");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
