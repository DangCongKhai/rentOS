import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokenCreatePanel } from "./api-token-create-panel";
import { createPersonalAccessToken } from "@/lib/tokens/api";
import { saveNewlyCreatedToken } from "@/lib/tokens/new-token-secret";

vi.mock("@/lib/http/client", () => ({
  ApiError: class ApiError extends Error {
    status = 400;
    errors = {};
  },
}));
vi.mock("@/lib/tokens/api", () => ({
  createPersonalAccessToken: vi.fn(),
  listPersonalAccessTokens: vi.fn(),
  revokePersonalAccessToken: vi.fn(),
}));
vi.mock("@/lib/tokens/new-token-secret", () => ({
  saveNewlyCreatedToken: vi.fn(),
  getNewlyCreatedToken: vi.fn(),
  clearNewlyCreatedToken: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("API token creation", () => {
  afterEach(cleanup);
  beforeEach(() => vi.mocked(createPersonalAccessToken).mockReset());

  it("offers custom and no-expiry choices and hands off the one-time secret", async () => {
    const user = userEvent.setup();
    vi.mocked(createPersonalAccessToken).mockResolvedValue({
      message: "Personal access token created.",
      plain_text_token: "1|one-time-secret",
      data: {
        id: "1",
        name: "Postman",
        abilities: ["account:read", "rental-requests:read"],
        created_at: "2026-11-17T00:00:00Z",
        last_used_at: null,
        expires_at: null,
        status: "ACTIVE",
      },
    });
    render(<ApiTokenCreatePanel />);

    expect(screen.queryByLabelText("Mật khẩu hiện tại")).toBeNull();
    expect(screen.queryByText(/favourites:write/)).toBeNull();
    await user.selectOptions(screen.getByLabelText("Thời hạn"), "custom");
    expect(screen.getByLabelText("Ngày hết hạn")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Thời hạn"), "never");
    await user.type(screen.getByLabelText("Tên mã"), "Postman");
    await user.click(screen.getByLabelText(/Đọc yêu cầu gửi đến bất động sản/));
    await user.click(screen.getByRole("button", { name: "Tạo mã truy cập" }));

    expect(createPersonalAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Postman",
        abilities: ["account:read", "rental-requests:read"],
        expires_at: null,
      }),
    );
    expect(saveNewlyCreatedToken).toHaveBeenCalledWith({
      name: "Postman",
      plainTextToken: "1|one-time-secret",
    });
  });
});
