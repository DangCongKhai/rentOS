import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFavouriteIds, setFavourite } from "./favourites-api";
import { FavouritesStore } from "./favourites-store";

vi.mock("./favourites-api", () => ({ getFavouriteIds: vi.fn(), setFavourite: vi.fn() }));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("favourites intent", () => {
  beforeEach(() => vi.resetAllMocks());

  it("serializes save then remove for the same property while keeping the latest heart state", async () => {
    vi.mocked(getFavouriteIds).mockResolvedValue({ ids: [], count: 0 });
    const save = deferred();
    const remove = deferred();
    const writes = vi.mocked(setFavourite).mockReturnValueOnce(save.promise).mockReturnValueOnce(remove.promise);
    const store = new FavouritesStore("account");
    const deactivate = store.activate();
    await waitFor(() => expect(store.snapshot().status).toBe("ready"));

    store.toggle("property");
    expect(store.snapshot().ids.has("property")).toBe(true);
    store.toggle("property");
    expect(store.snapshot().ids.has("property")).toBe(false);
    expect(writes).toHaveBeenCalledTimes(1);

    save.resolve();
    await waitFor(() => expect(writes).toHaveBeenNthCalledWith(2, "account", "property", false, expect.any(AbortSignal)));
    expect(store.snapshot().ids.has("property")).toBe(false);
    remove.resolve();
    await waitFor(() => expect(store.snapshot().notice).toBe("removed"));
    deactivate?.();
  });

  it("uses the server state after a failed request", async () => {
    vi.mocked(getFavouriteIds).mockResolvedValue({ ids: ["property"], count: 1 });
    const remove = deferred();
    vi.mocked(setFavourite).mockReturnValue(remove.promise);
    const store = new FavouritesStore("account");
    const deactivate = store.activate();
    await waitFor(() => expect(store.snapshot().status).toBe("ready"));

    store.toggle("property");
    expect(store.snapshot().ids.has("property")).toBe(false);
    remove.reject(new Error("Offline"));
    await waitFor(() => expect(store.snapshot().notice).toBe("error"));
    expect(store.snapshot().ids.has("property")).toBe(true);
    deactivate?.();
  });

  it("discards a previous account response and its queued write", async () => {
    vi.mocked(getFavouriteIds).mockImplementation(async (accountId) => accountId === "first"
      ? { ids: [], count: 0 } : { ids: ["second-property"], count: 1 });
    const save = deferred();
    const writes = vi.mocked(setFavourite).mockReturnValueOnce(save.promise);
    const first = new FavouritesStore("first");
    const deactivate = first.activate();
    await waitFor(() => expect(first.snapshot().status).toBe("ready"));
    first.toggle("first-property");
    first.toggle("first-property");
    deactivate?.();

    const second = new FavouritesStore("second");
    const stop = second.activate();
    save.resolve();
    await waitFor(() => expect(second.snapshot().status).toBe("ready"));
    expect([...second.snapshot().ids]).toEqual(["second-property"]);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0][3].aborted).toBe(true);
    stop?.();
  });

  it("does not send or replay a guest intent", async () => {
    const guest = new FavouritesStore(null);
    guest.toggle("property");
    vi.mocked(getFavouriteIds).mockResolvedValue({ ids: [], count: 0 });
    const authenticated = new FavouritesStore("signed-in");
    const stop = authenticated.activate();
    await waitFor(() => expect(authenticated.snapshot().status).toBe("ready"));
    expect(setFavourite).not.toHaveBeenCalled();
    stop?.();
  });
});
