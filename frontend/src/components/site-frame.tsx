"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return children;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 min-h-[calc(100vh-160px)] flex flex-col">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
