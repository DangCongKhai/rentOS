import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminApiProvider } from "@/components/admin/admin-api-provider";

export const metadata: Metadata = {
  title: "Bảng điều khiển Admin — rentOS",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminApiProvider><AdminShell>{children}</AdminShell></AdminApiProvider>;
}
