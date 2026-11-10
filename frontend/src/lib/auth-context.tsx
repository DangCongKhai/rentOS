"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUser, logout, type CurrentUser } from "./auth-api";
import { clearHeldNotifications } from "./notification-inbox";

export type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  user: CurrentUser | null;
  status: AuthStatus;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const currentUser = await getCurrentUser();
        if (active) {
          setUser(currentUser);
          setStatus("authenticated");
        }
      } catch {
        if (active) {
          setUser(null);
          setStatus("guest");
        }
      }
    }

    void init();

    const handleFocus = () => {
      void refreshUser();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
    };
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      clearHeldNotifications();
      setUser(null);
      setStatus("guest");
    }
  }, []);

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
