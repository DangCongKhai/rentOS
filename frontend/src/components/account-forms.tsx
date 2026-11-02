"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, login, registerAccount } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { FieldError, FormMessage } from "./auth-shell";
import { GoogleAuthButton } from "./google-auth-button";

type AuthMode = "login" | "register";

export function AccountForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isRegister = mode === "register";

  function validateClient(values: FormData): Record<string, string> {
    const newErrors: Record<string, string> = {};
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");

    // Email Validation
    if (!email) {
      newErrors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Địa chỉ email không phù hợp (ví dụ: name@example.com).";
    }

    // Password Validation
    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu.";
    }

    if (isRegister) {
      const name = String(values.get("name") ?? "").trim();
      const passwordConfirmation = String(values.get("password_confirmation") ?? "");

      // Name Validation
      if (!name) {
        newErrors.name = "Vui lòng nhập họ và tên của bạn.";
      }

      // Password Complexity for Register
      if (password) {
        if (password.length < 8) {
          newErrors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
        } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          newErrors.password = "Mật khẩu không phù hợp. Phải bao gồm cả chữ cái và chữ số.";
        }
      }

      // Password Confirmation
      if (!passwordConfirmation) {
        newErrors.password_confirmation = "Vui lòng nhập lại mật khẩu xác nhận.";
      } else if (password && password !== passwordConfirmation) {
        newErrors.password_confirmation = "Mật khẩu không trùng nhau. Vui lòng kiểm tra lại.";
      }
    }

    return newErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrors({});

    const form = event.currentTarget;
    const values = new FormData(form);

    // 1. Client-side Validation First
    const clientErrors = validateClient(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setMessage("");
      return;
    }

    setBusy(true);

    try {
      if (isRegister) {
        await registerAccount({
          name: String(values.get("name") ?? "").trim(),
          email: String(values.get("email") ?? "").trim(),
          password: String(values.get("password") ?? ""),
          password_confirmation: String(values.get("password_confirmation") ?? ""),
        });
        await refreshUser();
        router.push("/tenant");
        return;
      }

      await login({
        email: String(values.get("email") ?? "").trim(),
        password: String(values.get("password") ?? ""),
      });
      await refreshUser();
      router.push("/tenant");
    } catch (error) {
      if (error instanceof ApiError) {
        // Map backend errors to friendly Vietnamese messages
        let friendlyMessage = "";
        const fieldErrors: Record<string, string> = {};

        if (error.status === 401 || error.message.includes("These credentials do not match our records")) {
          friendlyMessage = "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.";
        } else if (error.errors) {
          for (const [field, msgs] of Object.entries(error.errors)) {
            const rawMsg = msgs[0] ?? "";
            if (rawMsg.includes("already been taken")) {
              fieldErrors[field] = "Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.";
            } else if (rawMsg.includes("confirmation")) {
              fieldErrors[field] = "Mật khẩu không trùng nhau. Vui lòng kiểm tra lại.";
            } else if (rawMsg.includes("at least 8")) {
              fieldErrors[field] = "Mật khẩu phải có ít nhất 8 ký tự.";
            } else {
              fieldErrors[field] = rawMsg;
            }
          }
        } else {
          friendlyMessage = error.message;
        }

        setMessage(friendlyMessage);
        setErrors(fieldErrors);
      } else {
        setMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
        setErrors({});
      }
    } finally {
      setBusy(false);
    }
  }

  function handleInputChange(field: string) {
    if (message) {
      setMessage("");
    }
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  }

  return (
    <>
      <div className="mb-5">
        <GoogleAuthButton mode={mode} />
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative bg-white px-3 text-xs text-slate-400 font-medium select-none">
            hoặc dùng email
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {isRegister && (
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Họ và tên</span>
            <input
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              name="name"
              autoComplete="name"
              placeholder="Nhập họ và tên của bạn"
              onChange={() => handleInputChange("name")}
              required
              maxLength={255}
              className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all ${
                errors.name
                  ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 bg-rose-50/10"
                  : "border-slate-300 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
              }`}
            />
            <FieldError id="name-error" message={errors.name} />
          </label>
        )}
        <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Email</span>
          <input
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={isRegister ? "Nhập địa chỉ email của bạn" : "mai.nguyen@email.com"}
            onChange={() => handleInputChange("email")}
            required
            maxLength={255}
            className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all ${
              errors.email
                ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 bg-rose-50/10"
                : "border-slate-300 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
            }`}
          />
          <FieldError id="email-error" message={errors.email} />
        </label>
        <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Mật khẩu</span>
          <input
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="••••••••"
            onChange={() => handleInputChange("password")}
            required
            className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all ${
              errors.password
                ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 bg-rose-50/10"
                : "border-slate-300 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
            }`}
          />
          <FieldError id="password-error" message={errors.password} />
          {isRegister && !errors.password && (
            <span className="block text-[11px] text-slate-500 font-normal mt-1">
              Ít nhất 8 ký tự, bao gồm cả chữ cái và chữ số.
            </span>
          )}
        </label>
        {isRegister && (
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Xác nhận mật khẩu</span>
            <input
              aria-invalid={Boolean(errors.password_confirmation)}
              aria-describedby={errors.password_confirmation ? "password_confirmation-error" : undefined}
              name="password_confirmation"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              onChange={() => handleInputChange("password_confirmation")}
              required
              className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all ${
                errors.password_confirmation
                  ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 bg-rose-50/10"
                  : "border-slate-300 focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
              }`}
            />
            <FieldError id="password_confirmation-error" message={errors.password_confirmation} />
          </label>
        )}

        {/* Remember me & Forgot password for Login */}
        {!isRegister && (
          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
              <input
                type="checkbox"
                name="remember"
                className="w-4 h-4 rounded border-slate-300 text-[#3368a0] focus:ring-[#3368a0]"
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-[#3368a0] hover:text-[#285584] font-medium hover:underline transition-colors"
            >
              Quên mật khẩu?
            </Link>
          </div>
        )}

        {/* Terms of Service Checkbox & Role Note for Register */}
        {isRegister && (
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-600 leading-snug">
              <input
                type="checkbox"
                required
                defaultChecked
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#3368a0] focus:ring-[#3368a0]"
              />
              <span>
                Tôi đồng ý với Điều khoản sử dụng và Chính sách riêng tư của rentOS.
              </span>
            </label>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <p>
                Không cần chọn vai trò khi đăng ký. Bạn trở thành người thuê khi bắt đầu thuê nhà, và trở thành chủ nhà khi bắt đầu đăng tin cho thuê. Cùng một tài khoản cho cả hai.
              </p>
            </div>
          </div>
        )}

        {message && <FormMessage message={message} error />}

        <button
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 mt-3"
          type="submit"
          disabled={busy}
        >
          <span>{busy ? "Đang xử lý…" : isRegister ? "Tạo tài khoản" : "Đăng nhập"}</span>
          <span aria-hidden="true" className="text-base font-normal">&rarr;</span>
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        {isRegister ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <Link href={isRegister ? "/login" : "/register"} className="text-[#3368a0] font-semibold hover:underline">
          {isRegister ? "Đăng nhập" : "Tạo tài khoản"}
        </Link>
      </p>
    </>
  );
}
