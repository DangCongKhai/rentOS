"use client";

import { useState } from "react";

interface GoogleAuthButtonProps {
  mode: "login" | "register";
}

export function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const [showNotice, setShowNotice] = useState(false);

  const label =
    mode === "register" ? "Đăng ký với Google" : "Đăng nhập với Google";

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={() => setShowNotice(true)}
        className="w-full min-h-[46px] px-4 py-2.5 rounded-md border border-border-strong bg-white hover:bg-slate-50 text-heading text-sm font-semibold inline-flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer select-none"
      >
        <svg
          className="w-5 h-5 shrink-0"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
          />
        </svg>
        <span>{label}</span>
      </button>

      {showNotice && (
        <div
          role="status"
          className="flex items-start justify-between gap-2 p-3 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-md animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">ℹ️</span>
            <span>
              Tính năng đăng nhập bằng Google đang được hoàn thiện và sẽ sớm ra
              mắt.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowNotice(false)}
            className="text-sky-600 hover:text-sky-900 font-bold px-1"
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
