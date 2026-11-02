import { Suspense } from "react";
import { ProfilePanel } from "@/components/profile-panel";

export const metadata = {
  title: "Hồ sơ cá nhân - Cổng Chủ Nhà | rentOS",
};

export default function OwnerProfilePage() {
  return (
    <Suspense fallback={<p className="text-center py-12 text-slate-500">Đang tải hồ sơ…</p>}>
      <ProfilePanel />
    </Suspense>
  );
}

