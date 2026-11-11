"use client";

import { notFound } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import {
  adminPreviewMode,
  getAdminDashboard,
  type AdminDashboard,
} from "@/lib/admin-review-api";

type AdminApiContext = {
  dashboard: AdminDashboard | null;
  revision: number;
  refresh: () => void;
};

const Context = createContext<AdminApiContext>({
  dashboard: null,
  revision: 0,
  refresh: () => {},
});

export function useAdminApi() {
  return useContext(Context);
}

export function AdminApiProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    accountId: string;
    data: AdminDashboard | null;
    error: Error | null;
  } | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (adminPreviewMode || status !== "authenticated" || !user?.is_admin) {
      return;
    }
    const controller = new AbortController();
    const accountId = user.id;
    getAdminDashboard(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ accountId, data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const failure =
          error instanceof Error ? error : new Error("Request failed.");
        setState({ accountId, data: null, error: failure });
      });
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [user, status, revision, refresh]);

  if (adminPreviewMode) {
    return (
      <Context.Provider value={{ dashboard: null, revision, refresh }}>
        {children}
      </Context.Provider>
    );
  }

  if (status !== "loading" && !user?.is_admin) {
    notFound();
  }

  const current = state?.accountId === user?.id ? state : null;
  if (current?.error || (current && !current.data)) {
    notFound();
  }

  const dashboard = current?.data ?? null;

  return (
    <Context.Provider value={{ dashboard, revision, refresh }}>
      {dashboard ? children : <div hidden>{children}</div>}
    </Context.Provider>
  );
}
