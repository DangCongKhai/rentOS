import { AuthShell } from "@/components/auth-shell";
import { GuestGuard } from "@/components/guest-guard";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = {
  title: "Đặt lại mật khẩu | rentOS",
  description: "Thiết lập mật khẩu mới an toàn cho tài khoản rentOS của bạn.",
};

export default function ResetPasswordPage() {
  return (
    <GuestGuard>
      <AuthShell
        eyebrow="BẢO MẬT TÀI KHOẢN"
        title="Đặt lại mật khẩu"
        description="Nhập mật khẩu mới an toàn để hoàn tất việc khôi phục tài khoản của bạn."
        marketingPanel
        welcomeTitle="Bảo mật là ưu tiên hàng đầu."
        welcomeCopy="Mật khẩu mạnh giúp bảo vệ quyền sở hữu căn hộ, dữ liệu hợp đồng và các giao dịch tài chính của bạn."
        welcomeFooter="Yêu cầu tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số."
      >
        <ResetPasswordForm />
      </AuthShell>
    </GuestGuard>
  );
}

