import { Suspense } from "react";
import { ProfilePanel } from "@/components/profile-panel";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <p className="px-6 py-16 text-center text-sm text-secondary">
          Đang tải hồ sơ…
        </p>
      }
    >
      <ProfilePanel />
    </Suspense>
  );
}
