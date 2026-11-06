import type React from "react";

export type BadgeColor = "blue" | "orange";

export interface NavBadge {
  count: string | number;
  color: BadgeColor;
}

export interface NavigationItem {
  id: string;
  name: string;
  href: string;
  badge?: NavBadge;
  icon: (props: { className?: string }) => React.JSX.Element;
}

export interface PortalConfig {
  sectionTitle: string;
  items: NavigationItem[];
  roleSwitcher: {
    targetHref: string;
    targetLabel: string;
  };
}

/* ==========================================================================
   Reusable SVG Icons (Extracted from Figma nodes 2009:1007 & 2009:1380)
   ========================================================================== */

export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function RequestsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function ContractsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function NotificationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function ReportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

export function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function GridOverviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

export function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

export function ListingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
      <path d="M6 14h7" />
    </svg>
  );
}

export function TenanciesCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

export function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/* ==========================================================================
   Tenant Portal Configuration (Figma Node 2009:1007)
   ========================================================================== */

export const TENANT_PORTAL_CONFIG: PortalConfig = {
  sectionTitle: "TRANG CỦA BẠN",
  roleSwitcher: {
    targetHref: "/owner",
    targetLabel: "Sang Cổng Chủ Nhà",
  },
  items: [
    {
      id: "tenant-dashboard",
      name: "Trang chính",
      href: "/tenant",
      icon: HomeIcon,
    },
    {
      id: "tenant-requests",
      name: "Yêu cầu thuê",
      href: "/tenant/requests",
      icon: RequestsIcon,
    },
    {
      id: "tenant-contracts",
      name: "Căn hộ và hợp đồng",
      href: "/tenant/contracts",
      badge: {
        count: "1",
        color: "orange",
      },
      icon: ContractsIcon,
    },
    {
      id: "tenant-notifications",
      name: "Thông báo",
      href: "/tenant/notifications",
      badge: {
        count: "2",
        color: "blue",
      },
      icon: NotificationsIcon,
    },
    {
      id: "tenant-reports",
      name: "Báo cáo của tôi",
      href: "/tenant/reports",
      icon: ReportsIcon,
    },
    {
      id: "tenant-profile",
      name: "Hồ sơ cá nhân",
      href: "/profile",
      icon: ProfileIcon,
    },
  ],
};

/* ==========================================================================
   Owner Portal Configuration (Figma Node 2009:1380)
   ========================================================================== */

export const OWNER_PORTAL_CONFIG: PortalConfig = {
  sectionTitle: "KHÔNG GIAN QUẢN LÝ",
  roleSwitcher: {
    targetHref: "/tenant",
    targetLabel: "Sang Cổng Cư Dân",
  },
  items: [
    {
      id: "owner-overview",
      name: "Tổng quan",
      href: "/owner",
      icon: GridOverviewIcon,
    },
    {
      id: "owner-properties",
      name: "Bất động sản",
      href: "/owner/properties",
      icon: BuildingIcon,
    },
    {
      id: "owner-listings",
      name: "Tin đăng",
      href: "/owner/listings",
      badge: {
        count: "1",
        color: "orange",
      },
      icon: ListingsIcon,
    },
    {
      id: "owner-requests",
      name: "Yêu cầu thuê",
      href: "/owner/requests",
      badge: {
        count: "3",
        color: "blue",
      },
      icon: RequestsIcon,
    },
    {
      id: "owner-tenancies",
      name: "Kỳ thuê và hợp đồng",
      href: "/owner/tenancies",
      badge: {
        count: "2",
        color: "blue",
      },
      icon: TenanciesCalendarIcon,
    },
    {
      id: "owner-notifications",
      name: "Thông báo",
      href: "/owner/notifications",
      icon: NotificationsIcon,
    },
    {
      id: "owner-profile",
      name: "Hồ sơ cá nhân",
      href: "/profile",
      icon: ProfileIcon,
    },
  ],
};
