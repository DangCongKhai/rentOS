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
          <Suspense fallback={null}>
            <SiteHeader />
          </Suspense>
          <main className="flex-1 min-h-[calc(100vh-160px)] flex flex-col">
            {children}
          </main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
