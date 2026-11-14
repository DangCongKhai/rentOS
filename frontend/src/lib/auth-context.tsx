"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, getCurrentUser, logout, type CurrentUser } from "./auth-api";
import { getQueryClient } from "./query-provider";

export type AuthStatus = "loading" | "authenticated" | "guest";

const currentUserKey = ["current-user"] as const;

function markCurrentUserGuest(): void {
  const client = getQueryClient();
  void client.cancelQueries({ queryKey: currentUserKey });
  client.setQueryData<CurrentUser | null>(currentUserKey, null);
  client.removeQueries({ queryKey: ["notifications"] });
  client.removeQueries({ queryKey: ["notifications-page"] });
}

interface AuthContextValue {
  user: CurrentUser | null;
  status: AuthStatus;
  refreshUser: () => Promise<CurrentUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: currentUserKey,
    queryFn: async () => {
      try {
        return await getCurrentUser();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
  });

  const user = query.data ?? null;
  const status: AuthStatus = query.isPending
    ? "loading"
    : query.isError || query.data == null
      ? "guest"
      : "authenticated";

  const refreshUser = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: currentUserKey });
    return queryClient.getQueryData<CurrentUser | null>(currentUserKey) ?? null;
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: currentUserKey });
    try {
      await logout();
    } finally {
      markCurrentUserGuest();
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, status, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
