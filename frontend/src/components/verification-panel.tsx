"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getCurrentUser, resendVerification } from "@/lib/auth-api";
import { FormMessage } from "./auth-shell";

export function VerificationPanel() {
  const searchParams = useSearchParams();
  const isVerifiedFromUrl = searchParams.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setEmail(user.email);
        setVerified(Boolean(user.email_verified_at));
      })
      .catch((error) => {
        setIsError(true);
        setNeedsLogin(error instanceof ApiError && error.status === 401);
        setMessage(
          error instanceof ApiError && error.status === 401
            ? "Đăng nhập để xem trạng thái xác minh hoặc gửi lại liên kết."
            : "Không thể kiểm tra trạng thái. Vui lòng tải lại trang để thử lại.",
        );
      });
  }, []);

  async function handleResend() {
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      await resendVerification();
      setMessage("Đã gửi lại email xác minh. Hãy kiểm tra hộp thư của bạn.");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Không thể gửi email lúc này.",
      );
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  const isEmailVerified = verified || isVerifiedFromUrl;

  return (
    <div className="flex flex-col items-start gap-4">
      {isEmailVerified ? (
        <>
          <div
            className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold"
            aria-hidden="true"
          >
            ✓
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Email đã được xác minh
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {isVerifiedFromUrl
              ? "Chúc mừng! Địa chỉ email của bạn đã được xác minh thành công. Bạn có thể tiếp tục sử dụng tất cả các tính năng của rentOS."
              : "Bạn có thể tiếp tục sử dụng các tính năng của rentOS."}
          </p>
          <Link
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors mt-2"
            href="/profile"
          >
            Đi đến hồ sơ
          </Link>
        </>
      ) : email ? (
        <>
          <div
            className="w-12 h-12 rounded-full bg-blue-50 text-[#3368a0] flex items-center justify-center text-xl font-bold"
            aria-hidden="true"
          >
            ✉
          </div>
          <h2 className="text-xl font-bold text-slate-900">Kiểm tra hộp thư</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Chúng tôi đã gửi liên kết xác minh đến <strong>{email}</strong>. Mở
            liên kết để xác nhận địa chỉ email của bạn.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 text-sm font-semibold transition-colors disabled:opacity-50"
              onClick={handleResend}
              disabled={busy}
            >
              {busy ? "Đang gửi…" : "Gửi lại email xác minh"}
            </button>
            <Link
              className="text-sm font-semibold text-[#3368a0] hover:underline"
              href="/profile"
            >
              Quay về hồ sơ &rarr;
            </Link>
          </div>
          {message && <FormMessage message={message} error={isError} />}
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold text-slate-900">
            {isError
              ? needsLogin
                ? "Đăng nhập để tiếp tục"
                : "Chưa thể tải trạng thái"
              : "Đang kiểm tra trạng thái…"}
          </h2>
          {needsLogin && (
            <Link
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors"
              href="/login"
            >
              Đăng nhập
            </Link>
          )}
          {message && <FormMessage message={message} error={isError} />}
        </>
      )}
    </div>
  );
}
