"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  getCurrentUser,
  resendVerification,
  updatePassword,
  updateProfile,
  type CurrentUser,
} from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { FieldError, FormMessage } from "./auth-shell";

const fieldClass =
  "w-full min-h-12 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100";

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function ProfilePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loadError, setLoadError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    Record<string, string[]>
  >({});
  const isVerifiedFromUrl = searchParams?.get("verified") === "1";
  const showVerifiedBanner = isVerifiedFromUrl && !bannerDismissed;

  useEffect(() => {
    if (isVerifiedFromUrl) {
      void refreshUser();
    }

    getCurrentUser()
      .then((current) => {
        setUser(current);
        setName(current.name);
        setPhone(current.phone ?? "");
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
        } else {
          setLoadError(
            "Không thể tải hồ sơ. Vui lòng tải lại trang để thử lại.",
          );
        }
      });
  }, [router, isVerifiedFromUrl, refreshUser]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError(false);
    setProfileMessage("");
    try {
      const updated = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
      });
      setUser(updated);
      setName(updated.name);
      setPhone(updated.phone ?? "");
      await refreshUser();
      setProfileMessage("Hồ sơ đã được cập nhật.");
    } catch (error) {
      setProfileMessage(
        error instanceof ApiError ? error.message : "Không thể cập nhật hồ sơ.",
      );
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
        password_confirmation: String(
          values.get("password_confirmation") ?? "",
        ),
      });
      await refreshUser();
      setPasswordOpen(false);
      setProfileError(false);
      setProfileMessage("Mật khẩu đã được cập nhật. Bạn vẫn đang đăng nhập.");
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

  async function handleResendVerification() {
    setResendBusy(true);
    setResendMessage("");
    setResendError(false);
    try {
      await resendVerification();
      setResendMessage(
        "Đã gửi lại liên kết xác minh. Vui lòng kiểm tra hộp thư của bạn.",
      );
    } catch (error) {
      setResendError(true);
      setResendMessage(
        error instanceof ApiError
          ? error.message
          : "Chưa thể gửi email xác minh lúc này.",
      );
    } finally {
      setResendBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <FormMessage message={loadError} error />
      </div>
    );
  }

  if (!user)
    return (
      <p className="px-6 py-16 text-center text-sm text-secondary">
        Đang tải hồ sơ…
      </p>
    );

  return (
    <div className="flex-1 bg-surface-app px-6 py-10 lg:px-10 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        {showVerifiedBanner && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
            <span>Email của bạn đã được xác minh thành công.</span>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-xs font-semibold"
              aria-label="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[680px] lg:grid-cols-[400px_minmax(0,1fr)]">
          <aside className="flex flex-col justify-between bg-[#091216] px-8 py-10 text-white lg:px-10 lg:py-12">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8FBCD0]">
                Tài khoản
              </p>
              <span
                aria-hidden="true"
                className="mt-8 inline-flex size-24 items-center justify-center rounded-full border border-white/15 bg-action-primary text-3xl font-semibold tracking-tight"
              >
                {initials(user.name)}
              </span>
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
                {user.name}
              </h1>
              <p className="mt-2 break-all text-sm text-[#BCD0DB]">
                {user.email}
              </p>
              <div className="mt-5" id="email-status">
                {user.email_verified_at ? (
                  <span className="inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Email đã xác minh
                  </span>
                ) : (
                  <div className="space-y-3">
                    <span className="inline-flex rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-100">
                      Email chưa xác nhận
                    </span>
                    <button
                      type="button"
                      className="block text-sm font-semibold text-[#8FBCD0] underline decoration-[#8FBCD0]/40 underline-offset-4 disabled:opacity-50"
                      onClick={handleResendVerification}
                      disabled={resendBusy}
                    >
                      {resendBusy ? "Đang gửi…" : "Gửi lại email xác thực"}
                    </button>
                  </div>
                )}
                {resendMessage && (
                  <p
                    className={`mt-3 text-xs leading-5 ${resendError ? "text-rose-200" : "text-emerald-200"}`}
                  >
                    {resendMessage}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-12">
              <div className="mb-4 h-0.5 w-11 bg-[#75B0C6]" />
              <p className="max-w-xs text-sm leading-6 text-[#BCD0DB]">
                Một tài khoản cho cả tìm nhà và quản lý cho thuê. Tên và số điện
                thoại có thể cập nhật bất cứ lúc nào.
              </p>
            </div>
          </aside>

          <form
            className="flex flex-col px-8 py-10 lg:px-12 lg:py-12"
            onSubmit={saveProfile}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Hồ sơ
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Thông tin tài khoản
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Email dùng để đăng nhập và nhận liên kết xác minh, nên không thể
              sửa tại đây.
            </p>

            <div className="mt-8 grid gap-5">
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                <span>Họ và tên</span>
                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={255}
                  autoComplete="name"
                  className={fieldClass}
                />
              </label>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700">
                  Email
                </span>
                <input
                  value={user.email}
                  disabled
                  readOnly
                  aria-readonly="true"
                  className={`${fieldClass} bg-slate-50 text-slate-600 cursor-not-allowed`}
                />
              </div>

              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                <span>Số điện thoại</span>
                <input
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Thêm số điện thoại"
                  autoComplete="tel"
                  maxLength={64}
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Mật khẩu</p>
              </div>
              <button
                type="button"
                className="min-h-12 shrink-0 rounded-lg border border-[#3368a0] bg-white px-5 text-sm font-semibold text-[#3368a0] transition-colors hover:bg-[#e8f2f7]"
                onClick={() => {
                  setPasswordOpen(true);
                  setPasswordMessage("");
                  setPasswordError(false);
                  setPasswordFieldErrors({});
                }}
              >
                Cập nhật mật khẩu
              </button>
            </div>

            {profileMessage && (
              <div className="mt-5">
                <FormMessage message={profileMessage} error={profileError} />
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                className="min-h-12 rounded-lg bg-[#3368a0] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#285584] disabled:opacity-50"
                type="submit"
                disabled={profileBusy}
              >
                {profileBusy ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {passwordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091216]/45 px-4"
          onClick={() => setPasswordOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_16px_40px_rgba(9,18,22,0.18)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={savePassword}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Bảo mật
            </p>
            <h2
              id="password-dialog-title"
              className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900"
            >
              Cập nhật mật khẩu
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Các phiên và mã truy cập khác sẽ bị thu hồi. Bạn vẫn đăng nhập
              trên trình duyệt này.
            </p>
            <div className="mt-6 space-y-4">
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                <span>Mật khẩu hiện tại</span>
                <input
                  aria-invalid={Boolean(passwordFieldErrors.current_password)}
                  aria-describedby={
                    passwordFieldErrors.current_password
                      ? "current-password-error"
                      : undefined
                  }
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={fieldClass}
                />
                <FieldError
                  id="current-password-error"
                  message={passwordFieldErrors.current_password?.[0]}
                />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                <span>Mật khẩu mới</span>
                <input
                  aria-invalid={Boolean(passwordFieldErrors.password)}
                  aria-describedby={
                    passwordFieldErrors.password
                      ? "new-password-error"
                      : undefined
                  }
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={fieldClass}
                />
                <FieldError
                  id="new-password-error"
                  message={passwordFieldErrors.password?.[0]}
                />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                <span>Xác nhận mật khẩu mới</span>
                <input
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={fieldClass}
                />
              </label>
            </div>
            {passwordMessage && (
              <div className="mt-4">
                <FormMessage message={passwordMessage} error={passwordError} />
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="min-h-12 px-4 text-sm font-semibold text-slate-600"
                onClick={() => setPasswordOpen(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-12 rounded-lg bg-[#3368a0] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#285584] disabled:opacity-50"
                disabled={passwordBusy}
              >
                {passwordBusy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
