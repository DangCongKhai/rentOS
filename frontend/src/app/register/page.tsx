import { AccountForm } from "@/components/account-forms";
import { AuthShell } from "@/components/auth-shell";
import { GuestGuard } from "@/components/guest-guard";

export default function RegisterPage() {
  return (
    <GuestGuard>
      <AuthShell
        eyebrow="BẮT ĐẦU CÙNG RENTOS"
        title="Tạo tài khoản"
        description="Bắt đầu với một tài khoản rentOS miễn phí."
        marketingPanel
        welcomeTitle="Một tài khoản. Nhiều khởi đầu mới."
        welcomeCopy="Tìm nơi ở phù hợp hoặc chia sẻ không gian của bạn — tất cả trên rentOS."
        welcomeFooter="Bình yên bắt đầu từ một nơi gọi là nhà."
      >
        <AccountForm mode="register" />
      </AuthShell>
    </GuestGuard>
  );
}
