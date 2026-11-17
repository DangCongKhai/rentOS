import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "@/lib/auth/api";
import { AccountForm } from "./account-forms";

const refreshUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ refreshUser }),
}));

vi.mock("@/lib/http/client", () => ({
  ApiError: class ApiError extends Error {
    status = 400;
  },
}));

vi.mock("@/lib/auth/api", () => ({
  login: vi.fn(),
  registerAccount: vi.fn(),
}));

describe("account login", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    refreshUser.mockReset();
    refreshUser.mockResolvedValue({
      id: "user-1",
      name: "Mai",
      email: "mai@example.com",
      email_verified_at: "2026-11-14T00:00:00Z",
      phone: null,
      is_admin: false,
    });
    vi.mocked(login).mockReset();
    vi.mocked(login).mockResolvedValue(undefined);
  });

  async function submitLogin(remember: boolean) {
    const user = userEvent.setup();
    render(<AccountForm mode="login" />);
    await user.type(screen.getByLabelText("Email"), "mai@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "secret-pass");
    if (remember) {
      await user.click(screen.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" }));
    }
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
  }

  it("posts remember true when the checkbox is checked", async () => {
    await submitLogin(true);

    expect(login).toHaveBeenCalledWith({
      email: "mai@example.com",
      password: "secret-pass",
      remember: true,
    });
  });

  it("posts remember false when the checkbox is unchecked", async () => {
    await submitLogin(false);

    expect(login).toHaveBeenCalledWith({
      email: "mai@example.com",
      password: "secret-pass",
      remember: false,
    });
  });
});
