"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { dashboardPreview } from "@/lib/admin-dashboard-preview";
import { useAdminReviewPreview } from "@/lib/admin-review-store";
import { adminPreviewMode } from "@/lib/admin-review-api";
import { useAdminApi } from "./admin-api-provider";
import { getReviewQueue } from "@/lib/admin-review-queue";
import { AdminIcon } from "./admin-icons";
import "./admin.css";

export function AdminShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const name = user?.name ?? dashboardPreview.administrator;
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase("vi") ?? "A";
  const pathname = usePathname();
  const isQueue = pathname.startsWith("/admin/review-queue");
  const { items, ready } = useAdminReviewPreview();
  const { dashboard } = useAdminApi();
  const queueCount = adminPreviewMode ? getReviewQueue(items).length : dashboard?.pending_count;

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const controls = sidebar.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    const desktop = window.matchMedia("(min-width: 1024px)");
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setMobileOpen(false);
    }
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  function closeMenu() {
    setMobileOpen(false);
    menuButton.current?.focus();
  }

  return (
    <div className="admin-shell">
      <a href="#admin-content" className="admin-skipLink">Đến nội dung chính</a>
      <header className="admin-header">
        <div className="admin-headerBrand">
          <button ref={menuButton} type="button" className="admin-menuButton" aria-label="Mở menu quản trị" aria-expanded={mobileOpen} aria-controls="admin-sidebar" onClick={() => setMobileOpen(true)}>
            <AdminIcon name="menu" />
          </button>
          <Link href="/" aria-label="rentOS - trang chủ" className="admin-logo">
            <Image src="/images/rentos-logo.png" alt="rentOS" width={130} height={37} className="admin-logoImage" style={{ height: "auto" }} />
          </Link>
          <span className="admin-consoleBadge"><AdminIcon name="shield" /> Admin console</span>
          <span className="admin-staffNote">Chỉ dành cho nhân viên · mọi thao tác được ghi nhật ký</span>
        </div>
        <div className="admin-headerAccount">
          <span className="admin-avatar" aria-hidden="true">{initial}</span>
          <span className="admin-headerName">{name}</span>
          <Link href="/" className="admin-exitButton"><AdminIcon name="exit" /><span>Thoát chế độ Admin</span></Link>
        </div>
      </header>

      {mobileOpen && <button type="button" className="admin-backdrop" aria-label="Đóng menu quản trị" tabIndex={-1} onClick={closeMenu} />}
      <aside id="admin-sidebar" ref={sidebar} className={`admin-sidebar ${mobileOpen ? "admin-sidebarOpen" : ""}`} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="Điều hướng quản trị">
        <div className="admin-sidebarBrand">
          <span className="admin-shieldTile"><AdminIcon name="shield" /></span>
          <div><strong>rentOS</strong><span>Admin console</span></div>
          <button type="button" className="admin-closeButton" aria-label="Đóng menu quản trị" onClick={closeMenu}><AdminIcon name="close" /></button>
        </div>
        <nav className="admin-navigation" aria-label="Menu quản trị">
          <Link href="/admin" className={`admin-navItem ${pathname === "/admin" ? "admin-navActive" : ""}`} aria-current={pathname === "/admin" ? "page" : undefined} onClick={closeMenu}>
            <span className="admin-navIcon"><AdminIcon name="dashboard" /></span><span>Bảng điều khiển</span>
          </Link>
          <Link href="/admin/review-queue" className={`admin-navItem ${isQueue ? "admin-navActive" : ""}`} aria-current={isQueue ? "page" : undefined} onClick={closeMenu}>
            <span className="admin-navIcon"><AdminIcon name="queue" /></span><span>Hàng đợi kiểm duyệt</span><span className="admin-count">{!adminPreviewMode || ready ? queueCount ?? "…" : "…"}</span>
          </Link>
          <button type="button" className="admin-navItem" disabled title="Báo cáo vi phạm thuộc RNT-08">
            <span className="admin-navIcon"><AdminIcon name="flag" /></span><span>Báo cáo vi phạm</span><span className="admin-count">{adminPreviewMode ? 2 : dashboard?.open_reports_count ?? 0}</span>
          </button>
          <button type="button" className="admin-navItem" disabled title="Danh sách tin đăng chưa được triển khai">
            <span className="admin-navIcon"><AdminIcon name="list" /></span><span>Danh sách tin đăng</span>
          </button>
        </nav>
        <div className="admin-sidebarBottom">
          <p className="admin-navigationNote">Các mục chưa triển khai đang tạm khóa.</p>
          <Link href="/" className="admin-exitLink"><AdminIcon name="back" />Thoát chế độ Admin</Link>
          <div className="admin-sidebarAccount"><span className="admin-avatar" aria-hidden="true">{initial}</span><div><strong>{name}</strong><span>{user ? "Tài khoản đang đăng nhập" : "Quản trị viên mẫu"}</span></div></div>
        </div>
      </aside>
      <main id="admin-content" tabIndex={-1} className="admin-content">{children}</main>
    </div>
  );
}
