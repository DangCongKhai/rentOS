"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, forgotPassword } from "@/lib/auth-api";
import { FieldError, FormMessage } from "./auth-shell";

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setEmailError("");

    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "").trim();

    if (!email) {
      setEmailError("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Địa chỉ email không phù hợp (ví dụ: name@example.com).");
      return;
    }

    setBusy(true);

    try {
      const response = await forgotPassword({ email });
      setSuccessMessage(
        response.message ||
          "Hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn."
      );
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          setErrorMessage("Bạn thao tác quá nhanh. Vui lòng chờ 1 phút rồi thử lại.");
        } else if (error.errors?.email?.[0]) {
          setEmailError(error.errors.email[0]);
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Không thể kết nối máy chủ. Vui lòng kiểm tra lại kết nối mạng.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (successMessage) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm leading-relaxed">
          <div className="flex items-center gap-2 font-bold mb-1">
            <span aria-hidden="true" className="text-emerald-600">✓</span>
            <span>Đã gửi hướng dẫn khôi phục</span>
          </div>
          <p>{successMessage}</p>
          <p className="mt-2 text-xs text-emerald-700">
            Hãy kiểm tra hộp thư đến (và cả mục Spam/Thư rác) của bạn. Liên kết có hiệu lực trong vòng 60 phút.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="w-full min-h-[48px] inline-flex items-center justify-center rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors text-center"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>Địa chỉ email</span>
        <input
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : undefined}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="mai.nguyen@email.com"
          onChange={() => {
            if (emailError) setEmailError("");
            if (errorMessage) setErrorMessage("");
          }}
          required
          maxLength={255}
          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all ${
            emailError
              ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-100 bg-red-50/20"
              : "border-slate-300 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
          }`}
        />
        <FieldError id="email-error" message={emailError} />
      </label>

      {errorMessage && <FormMessage message={errorMessage} error />}

      <button
        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 mt-3"
        type="submit"
        disabled={busy}
      >
        <span>{busy ? "Đang gửi yêu cầu…" : "Gửi liên kết đặt lại mật khẩu"}</span>
        <span aria-hidden="true" className="text-base font-normal">&rarr;</span>
      </button>

      <p className="mt-6 text-center text-sm text-slate-600">
        Bạn đã nhớ mật khẩu?{" "}
        <Link href="/login" className="text-[#3368a0] font-semibold hover:underline">
          Đăng nhập ngay
        </Link>
      </p>
    </form>
  );
}

