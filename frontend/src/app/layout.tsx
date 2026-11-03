import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { SiteFrame } from "@/components/site-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "rentOS — Tìm nơi ở phù hợp",
  description: "Một tài khoản cho người thuê và chủ nhà trên rentOS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen flex flex-col bg-surface-app text-primary antialiased">
        <AuthProvider>
          <Suspense
            fallback={
              <div
                className="flex flex-1 items-center justify-center p-6 text-secondary"
                role="status"
              >
                Đang tải trang…
              </div>
            }
          >
            <SiteFrame>{children}</SiteFrame>
          </Suspense>
          <main className="flex-1 flex flex-col">{children}</main>
          <Suspense fallback={null}>
            <SiteFooter />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
