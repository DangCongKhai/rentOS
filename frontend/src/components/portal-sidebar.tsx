"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  HelpIcon,
  OWNER_PORTAL_CONFIG,
  TENANT_PORTAL_CONFIG,
} from "@/config/navigation";

export function PortalSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOwnerView = pathname.startsWith("/owner");
  const portalConfig = isOwnerView ? OWNER_PORTAL_CONFIG : TENANT_PORTAL_CONFIG;

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 sm:p-5 select-none bg-[#0e1a20] text-[#BCD0DB]">
      <div>
        {/* Section Header */}
        <div className="px-3 pt-2 pb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#aeb8c6]">
            {portalConfig.sectionTitle}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5" aria-label="Điều hướng các Cổng">
          {portalConfig.items.map((item) => {
            const isActive = pathname === item.href
              || ((item.id === "tenant-requests" || item.id === "owner-requests") && pathname.startsWith(item.href + "/"));
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all min-h-[46px] ${
                  isActive
                    ? "bg-[#22313a] text-white font-semibold shadow-sm"
                    : "text-[#BCD0DB] hover:text-white hover:bg-white/5 font-medium"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? "text-white" : "text-[#BCD0DB]"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0 ${
                      item.badge.color === "orange"
                        ? "bg-[#c2410c]"
                        : "bg-[#3368a0]"
                    }`}
                  >
                    {item.badge.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Dual Role Switcher Card from Figma */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 mt-6 text-left">
          <strong className="block text-xs font-bold text-white mb-1">
            Một tài khoản, hai vai trò.
          </strong>
          <p className="text-[11px] text-[#aeb8c6] leading-relaxed mb-3">
            Dễ dàng chuyển giữa tìm nhà và quản lý bất động sản cho thuê của
            bạn.
          </p>
          <Link
            href={portalConfig.roleSwitcher.targetHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8FBCD0] hover:text-white transition-colors"
          >
            <span>{portalConfig.roleSwitcher.targetLabel}</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 mt-6 space-y-4">
        {/* Help & Support Link */}
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#c9d3e0] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <HelpIcon className="w-4 h-4 text-[#BCD0DB]" />
          <span>Trợ giúp & Hỗ trợ</span>
        </Link>

        {/* User Mini Profile */}
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
            <div className="w-8 h-8 rounded-full bg-[#1e293b] text-white flex items-center justify-center text-xs font-bold border border-white/20 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-[#BCD0DB] truncate">
                {user.email}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Bar */}
      <div className="lg:hidden w-full bg-[#0e1a20] border-b border-white/10 px-4 py-2.5 flex items-center justify-between text-white">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
          aria-expanded={mobileOpen}
          aria-label="Mở menu chuyển Cổng"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span>Danh mục Cổng</span>
        </button>
        <span className="text-xs text-[#BCD0DB] font-medium">
          {portalConfig.items.find((i) => i.href === pathname)?.name ||
            portalConfig.sectionTitle}
        </span>
      </div>

      {/* Mobile Drawer Backdrop & Panel */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 w-[260px] bg-[#0e1a20] text-[#BCD0DB] shadow-2xl z-50 flex flex-col pt-16">
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 text-[#BCD0DB] hover:text-white rounded-md hover:bg-white/10"
                aria-label="Đóng menu"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 bg-[#0e1a20] text-[#BCD0DB] border-r border-white/10 min-h-[calc(100vh-75px)] sticky top-[75px] self-start">
        {sidebarContent}
      </aside>
    </>
  );
}
