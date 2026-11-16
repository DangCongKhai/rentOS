import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { QueryProvider } from "@/lib/query-provider";
import { SiteFrame } from "@/components/site-frame";
import { FavouritesProvider } from "@/features/discovery/favourites-provider";
import "./globals.css";
import { LoadingScreen } from "@/components/loading-screen";

export const metadata: Metadata = {
  title: "rentOS — Tìm nơi ở phù hợp",
  description: "Một tài khoản cho người thuê và chủ nhà trên rentOS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-surface-app text-primary antialiased">
        <QueryProvider>
          <AuthProvider>
            <Suspense
              fallback={
                <LoadingScreen message="Đang tải trang..."/>
              }
            >
              <FavouritesProvider><SiteFrame>{children}</SiteFrame></FavouritesProvider>
            </Suspense>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
