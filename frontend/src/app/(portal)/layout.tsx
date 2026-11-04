import { Suspense } from "react";
import { Toaster } from "sonner";
import { PortalSidebar } from "@/components/portal-sidebar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-75px)] w-full bg-[#f8fafc]">
      <Suspense fallback={null}>
        <PortalSidebar />
      </Suspense>
      <main className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
