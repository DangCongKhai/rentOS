"use client";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

export function AdminAccess({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();

  if (status !== "loading" && !user?.is_admin) {
    notFound();
  }

  return children;
}
