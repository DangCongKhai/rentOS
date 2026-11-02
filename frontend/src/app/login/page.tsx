import { AccountForm } from "@/components/account-forms";
import { AuthShell } from "@/components/auth-shell";
import { GuestGuard } from "@/components/guest-guard";

export default function SignInPage() {
  return (
    <GuestGuard>
      <AuthShell
        eyebrow=""
        title="Đăng nhập"
        description="Tiếp tục hành trình của bạn cùng rentOS."
        marketingPanel
        welcomeTitle="Chào mừng bạn trở về."
        welcomeCopy="Những ngôi nhà bạn quan tâm và các hợp đồng đang chờ, luôn ở đây chờ bạn."
        welcomeFooter="Một tài khoản dùng cho cả tìm nhà và quản lý cho thuê."
      >
        <AccountForm mode="login" />
      </AuthShell>
    </GuestGuard>
  );
}
