import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proposeOwnerTenancyRenewal, requestTenantTenancyRenewal } from "@/lib/tenancies/api";
import { type TenancyRenewalRequest, type TenancyTimeline } from "@/lib/tenancies/types";
import { TenancyRenewalActions } from "./tenancy-renewal-actions";

vi.mock("@/lib/tenancies/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenancies/api")>()),
  proposeOwnerTenancyRenewal: vi.fn(),
  requestTenantTenancyRenewal: vi.fn(),
  rejectOwnerTenancyRenewal: vi.fn(),
  correctOwnerTenancyRenewal: vi.fn(),
  withdrawTenantTenancyRenewal: vi.fn(),
}));

const basisContract = {
  id: "contract-basis",
  version_number: 1,
  type: "ORIGINAL",
  renewal_request_id: null,
  supersedes_contract_id: null,
  basis_contract_id: null,
  start_date: "2026-12-01",
  end_date: "2027-04-30",
  monthly_rent: 4_000_000,
  deposit_amount: 4_000_000,
  policies_snapshot: {
    property: { shared_rules: ["Giữ yên tĩnh sau 22:00"] },
    unit: { pets: "NOT_ALLOWED", smoking: "NOT_ALLOWED", additional_rules: [] },
  },
  signed_on: null,
  created_at: "2026-11-01T00:00:00Z",
  owner_confirmed_at: "2026-11-01T00:00:00Z",
  tenant_confirmed_at: "2026-11-01T00:00:00Z",
  tenant_rejected_at: null,
  tenant_rejection_reason: null,
};

const renewalRequest: TenancyRenewalRequest = {
  id: "renewal-request-1",
  requested_end_date: "2027-10-31",
  proposed_monthly_rent: 4_200_000,
  message: "Mình muốn thuê tiếp 6 tháng.",
  status: "PENDING",
  reviewed_by: null,
  reviewed_at: null,
  review_reason: null,
  created_at: "2026-11-10T02:30:00Z",
  updated_at: "2026-11-10T02:30:00Z",
};

function makeTimeline(
  renewalRequests: TenancyRenewalRequest[] = [],
): TenancyTimeline {
  return {
    tenancy: {
      id: "tenancy-1",
      owner_id: "owner-1",
      tenant_id: "tenant-1",
      rental_request_id: "rental-request-1",
      unit_id: "unit-1",
      status: "ACTIVE",
      confirmed_start_date: "2026-12-01",
      confirmed_end_date: "2027-04-30",
      blocked_start_date: "2026-12-01",
      blocked_end_date: "2027-04-30",
      pending_contract_id: null,
      latest_confirmed_contract_id: basisContract.id,
      confirmation_expires_at: null,
      moved_in_at: "2026-12-01T00:00:00Z",
      actual_ended_at: null,
      end_reason: null,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-10T02:30:00Z",
    },
    rental_request: null,
    property: {
      id: "property-1",
      name: "Căn hộ mẫu",
      address_line: null,
      ward: null,
      city: "Đà Nẵng",
    },
    unit: { id: "unit-1", label: "A201" },
    participants: { owner_name: "Chủ nhà", tenant_name: "Người thuê" },
    contracts: [basisContract],
    renewal_requests: renewalRequests,
    pending_contract: null,
    current_agreement: basisContract,
    upcoming_agreements: [],
    events: [],
  };
}

describe("tenancy renewal actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets a tenant submit a renewal request from the current-term card", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(requestTenantTenancyRenewal).mockResolvedValue(renewalRequest);

    render(
      <TenancyRenewalActions
        party="tenant"
        timeline={makeTimeline()}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText(/Kỳ thuê kết thúc 30\/04\/2027\./)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Yêu cầu gia hạn" }));
    fireEvent.change(screen.getByLabelText("Ngày kết thúc mong muốn"), {
      target: { value: "2027-10-31" },
    });
    fireEvent.change(screen.getByLabelText("Giá thuê hàng tháng (₫)"), {
      target: { value: "4200000" },
    });
    await user.type(
      screen.getByLabelText("Lời nhắn (không bắt buộc)"),
      "Mình muốn thuê tiếp 6 tháng.",
    );
    await user.click(screen.getByRole("button", { name: "Gửi yêu cầu gia hạn" }));

    expect(requestTenantTenancyRenewal).toHaveBeenCalledWith(
      "tenancy-1",
      expect.objectContaining({
        requested_end_date: "2027-10-31",
        proposed_monthly_rent: 4_200_000,
        message: "Mình muốn thuê tiếp 6 tháng.",
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith("Đã gửi yêu cầu gia hạn cho chủ nhà.");
  });

  it("lets the owner propose renewal terms from a pending request", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(proposeOwnerTenancyRenewal).mockResolvedValue({
      tenancy_id: "tenancy-1",
      replayed: false,
    });

    render(
      <TenancyRenewalActions
        party="owner"
        timeline={makeTimeline([renewalRequest])}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText("31/10/2027")).toBeTruthy();
    expect(screen.getByText("4.200.000 ₫/tháng")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Đề xuất gia hạn" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: /Tôi đã kiểm tra các điều khoản gia hạn/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Gửi đề xuất gia hạn" }));

    expect(proposeOwnerTenancyRenewal).toHaveBeenCalledWith(
      "tenancy-1",
      renewalRequest.id,
      expect.objectContaining({
        end_date: renewalRequest.requested_end_date,
        monthly_rent: 4_200_000,
        deposit_amount: 4_000_000,
        policies_snapshot: basisContract.policies_snapshot,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith("Đã gửi đề xuất gia hạn cho người thuê.");
  });
});
