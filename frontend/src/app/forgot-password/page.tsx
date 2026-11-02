import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { GuestGuard } from "@/components/guest-guard";

export const metadata = {
  title: "Quên mật khẩu | rentOS",
  description: "Lấy lại quyền truy cập tài khoản rentOS của bạn qua email.",
};

export default function ForgotPasswordPage() {
  return (
    <GuestGuard>
      <AuthShell
        eyebrow="KHÔI PHỤC TÀI KHOẢN"
        title="Quên mật khẩu"
        description="Nhập địa chỉ email tài khoản của bạn để nhận liên kết đặt lại mật khẩu an toàn."
        marketingPanel
        welcomeTitle="Lấy lại quyền truy cập."
        welcomeCopy="Chúng tôi sẽ gửi liên kết bảo mật giúp bạn thiết lập mật khẩu mới một cách nhanh chóng và an toàn."
        welcomeFooter="Bảo vệ toàn vẹn thông tin và hợp đồng thuê của bạn."
      >
        <ForgotPasswordForm />
      </AuthShell>
    </GuestGuard>
  );
}

