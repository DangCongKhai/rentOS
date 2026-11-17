import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokensPanel } from "./api-tokens-panel";
import { listPersonalAccessTokens, revokePersonalAccessToken } from "@/lib/tokens/api";

vi.mock("@/lib/http/client", () => ({ ApiError: class ApiError extends Error {} }));
vi.mock("@/lib/tokens/api", () => ({
  createPersonalAccessToken: vi.fn(),
  listPersonalAccessTokens: vi.fn(),
  revokePersonalAccessToken: vi.fn(),
}));

describe("API token list", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.mocked(listPersonalAccessTokens).mockReset();
    vi.mocked(revokePersonalAccessToken).mockReset().mockResolvedValue();
  });

  it("lists token metadata, links to creation, documents API routes, and revokes a token", async () => {
    const user = userEvent.setup();
    vi.mocked(listPersonalAccessTokens).mockResolvedValue([{
      id: "1",
      name: "Postman laptop",
      abilities: ["account:read", "rental-requests:read"],
      created_at: "2026-11-17T00:00:00Z",
      last_used_at: null,
      expires_at: null,
      status: "ACTIVE",
    }]);
    render(<ApiTokensPanel />);

    expect(await screen.findByText("Postman laptop", { selector: "p" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tạo mã mới" }).getAttribute("href")).toBe("/api-tokens/new");
    expect(screen.getByText("/api/v1/tenant/rental-requests/{requestId}")).toBeTruthy();
    expect(screen.getAllByText("rental-requests:read").length).toBeGreaterThan(1);
    await user.click(screen.getByRole("button", { name: "Thu hồi" }));
    await waitFor(() => expect(revokePersonalAccessToken).toHaveBeenCalledWith("1"));
    expect(screen.queryByText("Postman laptop", { selector: "p" })).toBeNull();
  });
});
