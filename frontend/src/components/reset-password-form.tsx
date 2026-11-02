"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ApiError, resetPassword } from "@/lib/auth-api";
import { FieldError, FormMessage } from "./auth-shell";

function ResetPasswordFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const emailParam = searchParams.get("email") ?? "";

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Nếu URL không có token hoặc email, thông báo liên kết không hợp lệ
  if (!token || !emailParam) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed">
          <p className="font-bold mb-1">Liên kết không hợp lệ hoặc thiếu thông tin</p>
          <p>
            Đường dẫn đặt lại mật khẩu không chứa mã token xác thực hoặc địa chỉ email hợp lệ. Vui lòng kiểm tra lại liên kết trong email hoặc gửi lại yêu cầu mới.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="w-full min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors text-center"
        >
          Yêu cầu liên kết mới
        </Link>
      </div>
    );
  }

  function validateClient(values: FormData): Record<string, string> {
    const errors: Record<string, string> = {};
    const password = String(values.get("password") ?? "");
    const passwordConfirmation = String(values.get("password_confirmation") ?? "");

    if (!password) {
      errors.password = "Vui lòng nhập mật khẩu mới.";
    } else if (password.length < 8) {
      errors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = "Mật khẩu phải bao gồm cả chữ cái và chữ số.";
    }

    if (!passwordConfirmation) {
      errors.password_confirmation = "Vui lòng nhập lại mật khẩu xác nhận.";
    } else if (password && password !== passwordConfirmation) {
      errors.password_confirmation = "Mật khẩu xác nhận không khớp.";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setFieldErrors({});

    const form = event.currentTarget;
    const values = new FormData(form);

    const clientErrors = validateClient(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setBusy(true);

    try {
      await resetPassword({
        token,
        email: emailParam,
        password: String(values.get("password") ?? ""),
        password_confirmation: String(values.get("password_confirmation") ?? ""),
      });
      setSuccess(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 422) {
          const errorsObj: Record<string, string> = {};
          if (error.errors) {
            for (const [key, msgs] of Object.entries(error.errors)) {
              errorsObj[key] = msgs[0] ?? error.message;
            }
          }
          setFieldErrors(errorsObj);
          setErrorMessage(
            error.message ||
              "Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới."
          );
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Không thể kết nối máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm leading-relaxed">
          <div className="flex items-center gap-2 font-bold mb-1">
            <span aria-hidden="true" className="text-emerald-600">✓</span>
            <span>Đặt lại mật khẩu thành công</span>
          </div>
          <p>
            Mật khẩu mới của bạn đã được cập nhật an toàn. Mọi phiên đăng nhập cũ trên các thiết bị khác đã được thu hồi.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors text-center"
        >
          <span>Đăng nhập bằng mật khẩu mới</span>
          <span aria-hidden="true" className="text-base font-normal">&rarr;</span>
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>Tài khoản email</span>
        <input
          value={emailParam}
          readOnly
          aria-readonly="true"
          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm cursor-not-allowed outline-none"
        />
      </label>

      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>Mật khẩu mới</span>
        <input
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          onChange={() => {
            if (fieldErrors.password) {
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.password;
                return next;
              });
            }
          }}
          required
          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all ${
            fieldErrors.password
              ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 bg-rose-50/10"
              : "border-slate-300 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
          }`}
        />
        <FieldError id="password-error" message={fieldErrors.password} />
        {!fieldErrors.password && (
          <span className="block text-[11px] text-slate-500 font-normal mt-1">
            Ít nhất 8 ký tự, bao gồm cả chữ cái và chữ số.
          </span>
        )}
      </label>

      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>Xác nhận mật khẩu mới</span>
        <input
          aria-invalid={Boolean(fieldErrors.password_confirmation)}
          aria-describedby={
            fieldErrors.password_confirmation
              ? "password_confirmation-error"
              : undefined
          }
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          onChange={() => {
            if (fieldErrors.password_confirmation) {
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.password_confirmation;
                return next;
              });
            }
          }}
          required
          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all ${
            fieldErrors.password_confirmation
              ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 bg-rose-50/10"
              : "border-slate-300 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
          }`}
        />
        <FieldError
          id="password_confirmation-error"
          message={fieldErrors.password_confirmation}
        />
      </label>

      {errorMessage && (
        <div>
          <FormMessage message={errorMessage} error />
          {errorMessage.includes("hết hạn") ||
          errorMessage.includes("không hợp lệ") ? (
            <Link
              href="/forgot-password"
              className="mt-2 inline-block text-xs font-semibold text-[#3368a0] hover:underline"
            >
              Yêu cầu liên kết đặt lại mật khẩu mới &rarr;
            </Link>
          ) : null}
        </div>
      )}

      <button
        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 mt-3"
        type="submit"
        disabled={busy}
      >
        <span>{busy ? "Đang cập nhật mật khẩu…" : "Xác nhận đặt lại mật khẩu"}</span>
        <span aria-hidden="true" className="text-base font-normal">&rarr;</span>
      </button>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="text-[#3368a0] font-semibold hover:underline">
          &larr; Quay lại trang Đăng nhập
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-slate-500">
          Đang xác thực liên kết bảo mật…
        </div>
      }
    >
      <ResetPasswordFormContent />
    </Suspense>
  );
}
