"use client";

import { usePathname } from "next/navigation";

const portalPrefixes = ["/owner", "/tenant", "/admin"];

export function SiteFooter() {
  const pathname = usePathname();
  const isPortal = portalPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isPortal) return null;

  return (
    <footer className="border-t border-border-default/40 bg-surface-card/60 py-6 text-center text-xs text-muted">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
        <span>© 2026 rentOS. Nơi để ở. Chốn để thuộc về.</span>
        <span className="text-muted/80">
          Tìm nơi ở phù hợp · Quản lý an tâm
        </span>
      </div>
    </footer>
  );
}
