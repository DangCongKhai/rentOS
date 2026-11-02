import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { VerificationPanel } from "@/components/verification-panel";

export default function VerifyEmailPage() {
  return (
    <AuthShell eyebrow="XÁC MINH TÀI KHOẢN" title="Xác minh email" description="Xác nhận email để bảo vệ tài khoản và sử dụng đầy đủ tính năng.">
      <Suspense fallback={<div className="text-sm text-slate-500 py-4">Đang tải trạng thái xác minh...</div>}>
        <VerificationPanel />
      </Suspense>
    </AuthShell>
  );
}
