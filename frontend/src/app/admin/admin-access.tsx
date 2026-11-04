"use client";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { useAuth } from "@/lib/auth-context";

export function AdminAccess({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();

  if (status === "loading") {
    return <LoadingScreen message="Đang tải trang quản trị..." />;
  }

  if (!user?.is_admin) {
    notFound();
  }

  return children;
}
