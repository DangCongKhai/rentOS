import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokenCreatePanel } from "./api-token-create-panel";
import { createPersonalAccessToken } from "@/lib/tokens/api";

vi.mock("@/lib/http/client", () => ({ ApiError: class ApiError extends Error { status = 400; errors = {}; } }));
vi.mock("@/lib/tokens/api", () => ({
  createPersonalAccessToken: vi.fn(),
  listPersonalAccessTokens: vi.fn(),
  revokePersonalAccessToken: vi.fn(),
}));

describe("API token creation", () => {
  afterEach(cleanup);
  beforeEach(() => vi.mocked(createPersonalAccessToken).mockReset());

  it("offers custom and no-expiry choices and displays the secret only after creation", async () => {
    const user = userEvent.setup();
    vi.mocked(createPersonalAccessToken).mockResolvedValue({
      message: "Personal access token created.",
      plain_text_token: "1|one-time-secret",
      data: {
        id: "1", name: "Postman", abilities: ["account:read", "rental-requests:read"],
        created_at: "2026-11-17T00:00:00Z", last_used_at: null, expires_at: null, status: "ACTIVE",
      },
    });
    render(<ApiTokenCreatePanel />);

    expect(screen.queryByLabelText("Mật khẩu hiện tại")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Thời hạn"), "custom");
    expect(screen.getByLabelText("Ngày hết hạn")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Thời hạn"), "never");
    await user.type(screen.getByLabelText("Tên mã"), "Postman");
    await user.click(screen.getByLabelText(/Đọc yêu cầu thuê/));
    await user.click(screen.getByRole("button", { name: "Tạo mã truy cập" }));

    expect(createPersonalAccessToken).toHaveBeenCalledWith(expect.objectContaining({
      name: "Postman",
      abilities: ["account:read", "rental-requests:read"],
      expires_at: null,
    }));
    expect(await screen.findByText("1|one-time-secret")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quay lại danh sách mã" }).getAttribute("href")).toBe("/api-tokens");
  });
});
