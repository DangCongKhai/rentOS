"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, getCurrentUser, resendVerification, updatePassword, updateProfile, type CurrentUser } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { FieldError, FormMessage } from "./auth-shell";

export function ProfilePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser, signOut: authSignOut } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const isVerifiedFromUrl = searchParams?.get("verified") === "1";
  const showVerifiedBanner = isVerifiedFromUrl && !bannerDismissed;
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (isVerifiedFromUrl) {
      void refreshUser();
    }

    getCurrentUser().then(setUser).catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
      } else {
        setLoadError("Không thể tải hồ sơ. Vui lòng tải lại trang để thử lại.");
      }
    });
  }, [router, isVerifiedFromUrl, refreshUser]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError(false);
    setProfileMessage("");
    const values = new FormData(event.currentTarget);
    try {
      const updated = await updateProfile({
        name: String(values.get("name") ?? ""),
        phone: String(values.get("phone") ?? "").trim() || null,
      });
      setUser(updated);
      await refreshUser();
      setProfileMessage("Hồ sơ đã được cập nhật.");
    } catch (error) {
      setProfileMessage(error instanceof ApiError ? error.message : "Không thể cập nhật hồ sơ.");
      setProfileError(true);
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError(false);
    setPasswordMessage("");
    setPasswordFieldErrors({});
    const values = new FormData(event.currentTarget);
    try {
      await updatePassword({
        current_password: String(values.get("current_password") ?? ""),
        password: String(values.get("password") ?? ""),
        password_confirmation: String(values.get("password_confirmation") ?? ""),
      });
      setPasswordMessage("Mật khẩu đã đổi. Hãy đăng nhập lại bằng mật khẩu mới.");
      setUser(null);
      await authSignOut();
      router.replace("/login");
    } catch (error) {
      if (error instanceof ApiError) {
        setPasswordMessage(error.message);
        setPasswordFieldErrors(error.errors);
      } else {
        setPasswordMessage("Không thể đổi mật khẩu lúc này.");
      }
      setPasswordError(true);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function signOut() {
    setLogoutBusy(true);
    try {
      await authSignOut();
      setUser(null);
      router.replace("/login");
    } catch (error) {
      setProfileMessage(error instanceof ApiError ? error.message : "Đăng xuất chưa hoàn tất. Vui lòng thử lại.");
      setProfileError(true);
      setLogoutBusy(false);
    }
  }

  async function handleResendVerification() {
    setResendBusy(true);
    setResendMessage("");
    setResendError(false);
    try {
      await resendVerification();
      setResendMessage("Đã gửi lại liên kết xác minh. Vui lòng kiểm tra hộp thư của bạn.");
    } catch (error) {
      setResendError(true);
      setResendMessage(error instanceof ApiError ? error.message : "Chưa thể gửi email xác minh lúc này.");
    } finally {
      setResendBusy(false);
    }
  }

  if (loadError) return <FormMessage message={loadError} error />;

  if (!user) return <p className="text-center py-12 text-slate-500">Đang tải hồ sơ…</p>;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
      {showVerifiedBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm leading-relaxed flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 font-medium">
            <span aria-hidden="true" className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
            <span>Email của bạn đã được xác minh thành công! Bạn có thể sử dụng đầy đủ các tính năng trên rentOS.</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-emerald-100 transition-colors"
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Profile Settings Card */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Thông tin tài khoản</span>
          <h2 className="text-xl font-bold text-slate-900 mt-1 mb-1">Hồ sơ của bạn</h2>
        </div>
        <form className="space-y-4" onSubmit={saveProfile}>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Họ và tên</span>
            <input
              name="name"
              defaultValue={user.name}
              required
              maxLength={255}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </label>
          <div className="space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Email</span>
            <input
              value={user.email}
              readOnly
              aria-describedby="email-status"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm cursor-not-allowed outline-none"
            />
            <div className="pt-1.5" id="email-status">
              {user.email_verified_at ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  <span aria-hidden="true" className="font-bold">✓</span> Email đã xác minh
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                    <span aria-hidden="true" className="font-bold">!</span> Email chưa xác nhận
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#3368a0] hover:text-[#285584] underline transition-colors cursor-pointer disabled:opacity-50"
                    onClick={handleResendVerification}
                    disabled={resendBusy}
                  >
                    {resendBusy ? "Đang gửi…" : "Gửi lại email xác thực"}
                  </button>
                </div>
              )}
            </div>
            {resendMessage && (
              <small className={`block text-xs mt-1.5 ${resendError ? "text-rose-600" : "text-emerald-600"}`}>
                {resendMessage}
              </small>
            )}
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Số điện thoại liên hệ</span>
            <input
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ""}
              autoComplete="tel"
              maxLength={64}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            <small className="block text-[11px] font-normal text-slate-500">Số điện thoại là thông tin liên hệ, chưa được xác minh.</small>
          </label>
          {profileMessage && <FormMessage message={profileMessage} error={profileError} />}
          <button
            className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 mt-2"
            type="submit"
            disabled={profileBusy}
          >
            {profileBusy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </form>
        <button
          type="button"
          className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline mt-4 inline-block cursor-pointer disabled:opacity-50"
          onClick={signOut}
          disabled={logoutBusy}
        >
          {logoutBusy ? "Đang đăng xuất…" : "Đăng xuất"}
        </button>
      </section>

      {/* Password Change Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Bảo mật</span>
          <h2 className="text-xl font-bold text-slate-900 mt-1 mb-1">Đổi mật khẩu</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Nhập mật khẩu hiện tại để xác nhận thay đổi. Sau khi đổi, mọi phiên đăng nhập sẽ bị thu hồi và bạn cần đăng nhập lại.
          </p>
        </div>
        <form className="space-y-4" onSubmit={savePassword}>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Mật khẩu hiện tại</span>
            <input
              aria-invalid={Boolean(passwordFieldErrors.current_password)}
              aria-describedby={passwordFieldErrors.current_password ? "current-password-error" : undefined}
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            <FieldError id="current-password-error" message={passwordFieldErrors.current_password?.[0]} />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Mật khẩu mới</span>
            <input
              aria-invalid={Boolean(passwordFieldErrors.password)}
              aria-describedby={passwordFieldErrors.password ? "new-password-error" : undefined}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            <FieldError id="new-password-error" message={passwordFieldErrors.password?.[0]} />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Xác nhận mật khẩu mới</span>
            <input
              name="password_confirmation"
              type="password"
              autoComplete="new-password"
              required
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </label>
          {passwordMessage && <FormMessage message={passwordMessage} error={passwordError} />}
          <button
            className="w-full min-h-[44px] flex items-center justify-center rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 mt-2"
            type="submit"
            disabled={passwordBusy}
          >
            {passwordBusy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
          </button>
        </form>
      </section>

      {/* Role Portal Navigation Shortcuts */}
      <section className="col-span-1 lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">KHÔNG GIAN TIỆN ÍCH</span>
          <h2 className="text-xl font-bold text-slate-900 mt-1 mb-1">Cổng dịch vụ vai trò của bạn</h2>
          <p className="text-sm text-slate-600">
            Truy cập nhanh các cổng chức năng chuyên biệt theo quan hệ tài nguyên thực tế của bạn trên rentOS.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <strong className="text-base text-slate-900 flex items-center gap-2">🔑 Cổng Cư Dân</strong>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Theo dõi hợp đồng thuê, thanh toán tiền phòng và các yêu cầu hỗ trợ cư dân.
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-xs font-semibold shadow-sm transition-colors self-start"
              href="/tenant"
            >
              Vào Cổng Cư Dân &rarr;
            </Link>
          </div>
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <strong className="text-base text-slate-900 flex items-center gap-2">🏢 Cổng Chủ Nhà</strong>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Quản lý danh mục bất động sản, phòng cho thuê và theo dõi hợp đồng người thuê.
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-xs font-semibold shadow-sm transition-colors self-start"
              href="/owner"
            >
              Vào Cổng Chủ Nhà &rarr;
            </Link>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
