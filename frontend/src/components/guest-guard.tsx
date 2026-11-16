"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(user?.email_verified_at ? "/" : "/profile");
    }
  }, [status, user, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-muted">
        <span role="status">Đang kiểm tra phiên làm việc…</span>
      </div>
    );
  }

  return <>{children}</>;
}
