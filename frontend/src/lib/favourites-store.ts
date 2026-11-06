import { getFavouriteIds, setFavourite } from "./favourites-api";

type Notice = "saved" | "removed" | "error";
type State = {
  ids: ReadonlySet<string>;
  status: "loading" | "ready" | "error";
  revision: number;
  notice: Notice | null;
};

export class FavouritesStore {
  private committed = new Set<string>();
  private intents = new Map<string, boolean>();
  private writes = new Set<string>();
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private state: State;

  constructor(private accountId: string | null) {
    this.state = { ids: new Set(), status: accountId ? "loading" : "ready", revision: 0, notice: null };
  }

  snapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  activate = () => {
    if (!this.accountId) return;
    const controller = new AbortController();
    this.controller = controller;
    void this.load(controller);
    return () => {
      controller.abort();
      this.controller = null;
      this.intents.clear();
      this.writes.clear();
    };
  };

  retry = () => {
    if (this.controller && this.state.status === "error") {
      this.publish({ status: "loading", notice: null });
      void this.load(this.controller);
    }
  };

  dismiss = () => this.publish({ notice: null });

  toggle = (propertyId: string) => {
    if (!this.controller || this.state.status !== "ready") return;
    this.intents.set(propertyId, !this.state.ids.has(propertyId));
    this.publish();
    if (!this.writes.has(propertyId)) {
      this.writes.add(propertyId);
      void this.flush(propertyId, this.controller.signal);
    }
  };

  private publish(patch: Partial<State> = {}) {
    const ids = new Set(this.committed);
    for (const [id, saved] of this.intents) {
      if (saved) ids.add(id);
      else ids.delete(id);
    }
    this.state = { ...this.state, ...patch, ids };
    this.listeners.forEach((listener) => listener());
  }

  private async load(controller: AbortController) {
    if (!this.accountId) return;
    try {
      const data = await getFavouriteIds(this.accountId, controller.signal);
      if (controller.signal.aborted) return;
      this.committed = new Set(data.ids);
      this.publish({ status: "ready", revision: this.state.revision + 1 });
    } catch {
      if (!controller.signal.aborted) this.publish({ status: "error", notice: "error" });
    }
  }

  private async flush(propertyId: string, signal: AbortSignal) {
    if (!this.accountId) return;
    while (!signal.aborted) {
      const desired = this.intents.get(propertyId);
      if (desired === undefined) break;
      let notice: Notice = desired ? "saved" : "removed";
      try {
        await setFavourite(this.accountId, propertyId, desired, signal);
        if (signal.aborted) return;
        this.commit(propertyId, desired);
      } catch {
        if (signal.aborted) return;
        notice = "error";
        try {
          const data = await getFavouriteIds(this.accountId, signal);
          if (signal.aborted) return;
          const actual = data.ids.includes(propertyId);
          this.commit(propertyId, actual);
          if (actual === desired) notice = desired ? "saved" : "removed";
        } catch {
          if (signal.aborted) return;
        }
      }

      const latest = this.intents.get(propertyId);
      if (latest === desired || latest === this.committed.has(propertyId)) {
        this.intents.delete(propertyId);
        this.publish({ revision: this.state.revision + 1, notice });
      } else {
        this.publish({ revision: this.state.revision + 1 });
      }
    }
    if (!signal.aborted) this.writes.delete(propertyId);
  }

  private commit(id: string, saved: boolean) {
    if (saved) this.committed.add(id);
    else this.committed.delete(id);
  }
}
