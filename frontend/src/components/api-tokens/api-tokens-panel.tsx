"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/http/client";
import {
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from "@/lib/tokens/api";
import {
  clearNewlyCreatedToken,
  getNewlyCreatedToken,
  type NewlyCreatedToken,
} from "@/lib/tokens/new-token-secret";
import type { PersonalAccessToken } from "@/lib/tokens/types";

function formatDate(value: string | null): string {
  if (!value) return "Không hết hạn";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function ApiTokensPanel() {
  const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingRevoke, setPendingRevoke] =
    useState<PersonalAccessToken | null>(null);
  const [newlyCreatedToken, setNewlyCreatedToken] =
    useState<NewlyCreatedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const lifecycleGeneration = useRef(0);

  useEffect(() => {
    let isMounted = true;
    lifecycleGeneration.current += 1;
    void listPersonalAccessTokens()
      .then((items) => {
        if (!isMounted) return;
        setTokens(items);
        setNewlyCreatedToken(getNewlyCreatedToken());
      })
      .catch((cause: unknown) => {
        if (isMounted)
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Không thể tải danh sách mã truy cập.",
          );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
      const cleanupGeneration = ++lifecycleGeneration.current;
      queueMicrotask(() => {
        if (lifecycleGeneration.current === cleanupGeneration) {
          clearNewlyCreatedToken();
        }
      });
    };
  }, []);

  async function revoke(token: PersonalAccessToken) {
    const id = token.id;
    setBusyTokenId(id);
    setError("");
    try {
      await revokePersonalAccessToken(id);
      setTokens((current) => current.filter((token) => token.id !== id));
      setPendingRevoke(null);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không thể thu hồi mã truy cập.",
      );
    } finally {
      setBusyTokenId(null);
    }
  }

  async function copyNewToken() {
    if (!newlyCreatedToken) return;
    try {
      await navigator.clipboard.writeText(newlyCreatedToken.plainTextToken);
      setCopied(true);
    } catch {
      setError("Không thể sao chép mã. Hãy chọn và sao chép mã thủ công.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
      <Link
        href="/profile"
        className="text-sm font-semibold text-[#3368a0] hover:underline"
      >
        ← Quay lại hồ sơ
      </Link>
      <header className="mt-8 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Bảo mật
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            Mã truy cập API
          </h1>
        </div>
        <Link
          href="/api-tokens/new"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#3368a0] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#285584]"
        >
          Tạo mã mới
        </Link>
      </header>
      <p className="mt-5 text-sm leading-6 text-slate-600">
        Mã truy cập cho phép công cụ bên ngoài gọi các API được cấp quyền. Mã
        đầy đủ chỉ xuất hiện ngay sau khi tạo.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {newlyCreatedToken && (
        <section
          aria-label="Mã truy cập mới"
          className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-amber-950">
                Mã “{newlyCreatedToken.name}” đã được tạo
              </h2>
              <p className="mt-1 text-sm text-amber-900">
                Sao chép và lưu mã này ngay. Mã chỉ được giữ tạm trong bộ nhớ
                của trang và sẽ biến mất khi tải lại hoặc rời trang.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs text-slate-800">
                  {newlyCreatedToken.plainTextToken}
                </code>
                <button
                  type="button"
                  aria-label={copied ? "Đã sao chép mã" : "Sao chép mã"}
                  title={copied ? "Đã sao chép" : "Sao chép mã"}
                  onClick={() => void copyNewToken()}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white text-slate-700 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3368a0]"
                >
                  {copied ? (
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5">
                      <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5">
                      <rect x="7" y="6" width="9" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M13 6V4.8A1.8 1.8 0 0 0 11.2 3H5.8A1.8 1.8 0 0 0 4 4.8v7.4A1.8 1.8 0 0 0 5.8 14H7" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  )}
                </button>
              </div>
              {copied && <p role="status" className="mt-2 text-xs font-medium text-emerald-800">Đã sao chép mã vào clipboard.</p>}
            </div>
          </div>
        </section>
      )}
      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-slate-900">Các mã đã tạo</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Đang tải…</p>
        ) : tokens.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Bạn chưa tạo mã truy cập nào.
          </p>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto px-5 sm:px-6">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {token.name}{" "}
                    <span
                      className={`ml-2 text-xs font-medium ${token.status === "ACTIVE" ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {token.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Đã hết hạn"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Quyền: {token.abilities.join(", ")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Tạo {formatDate(token.created_at)} · Dùng gần nhất{" "}
                    {formatDate(token.last_used_at)} · Hết hạn{" "}
                    {formatDate(token.expires_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyTokenId !== null}
                  onClick={() => setPendingRevoke(token)}
                  className="min-h-10 shrink-0 rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Thu hồi
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {pendingRevoke && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingRevoke(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="revoke-token-title"
            aria-describedby="revoke-token-description"
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="revoke-token-title" className="font-bold text-slate-900">
                Thu hồi mã truy cập?
              </h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setPendingRevoke(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </header>
            <p
              id="revoke-token-description"
              className="border-y border-amber-300 bg-amber-50 px-5 py-5 text-sm leading-6 text-slate-800"
            >
              Ứng dụng hoặc tập lệnh đang dùng mã “{pendingRevoke.name}” sẽ
              không thể truy cập API nữa. Bạn không thể hoàn tác thao tác này.
            </p>
            {error && (
              <p role="alert" className="px-5 pt-4 text-sm text-rose-700">
                {error}
              </p>
            )}
            <footer className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busyTokenId !== null}
                onClick={() => setPendingRevoke(null)}
                className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busyTokenId !== null}
                onClick={() => void revoke(pendingRevoke)}
                className="min-h-10 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {busyTokenId === pendingRevoke.id
                  ? "Đang thu hồi…"
                  : "Tôi hiểu, thu hồi mã này"}
              </button>
            </footer>
          </section>
        </div>
      )}
      <ApiUsageGuide />
    </section>
  );
}

function ApiUsageGuide() {
  const endpoints = [
    {
      method: "GET",
      path: "/api/v1/me",
      ability: "account:read",
      description: "Thông tin tài khoản hiện tại",
    },
    {
      method: "GET",
      path: "/api/v1/favourite-properties",
      ability: "favourites:read",
      description: "Danh sách yêu thích",
    },
    {
      method: "GET",
      path: "/api/v1/favourite-properties/ids",
      ability: "favourites:read",
      description: "ID các mục yêu thích",
    },
    {
      method: "GET",
      path: "/api/v1/owner/rental-requests?status=ALL",
      ability: "rental-requests:read",
      description: "Tất cả yêu cầu trên các bất động sản của bạn",
    },
    {
      method: "GET",
      path: "/api/v1/owner/rental-requests/{requestId}",
      ability: "rental-requests:read",
      description: "Chi tiết yêu cầu thuộc bất động sản của bạn",
    },
  ];
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Hướng dẫn gọi API</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Gửi mã trong header{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">
          Authorization: Bearer YOUR_TOKEN
        </code>
        . Mỗi route vẫn chỉ trả về dữ liệu thuộc tài khoản của mã.
      </p>
      <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
          <thead className="sticky top-0 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-3 font-semibold">Method</th>
              <th className="px-3 py-3 font-semibold">Endpoint</th>
              <th className="px-3 py-3 font-semibold">Quyền</th>
              <th className="px-3 py-3 font-semibold">Mô tả</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {endpoints.map((endpoint) => (
              <tr key={`${endpoint.method}:${endpoint.path}`}>
                <td className="px-3 py-3">
                  <code className="font-bold text-[#285584]">
                    {endpoint.method}
                  </code>
                </td>
                <td className="px-3 py-3">
                  <code className="whitespace-nowrap text-slate-800">
                    {endpoint.path}
                  </code>
                </td>
                <td className="px-3 py-3">
                  <code className="whitespace-nowrap text-slate-600">
                    {endpoint.ability}
                  </code>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {endpoint.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mt-5 text-sm font-bold text-slate-800">Ví dụ với cURL</h3>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        <code>
          `curl &quot;{process.env.NEXT_PUBLIC_API_URL}/api/v1/owner/rental-requests?status=ALL&quot; -H &quot;Accept: application/json&quot; -H &quot;Authorization: Bearer YOUR_TOKEN&quot;`
        </code>
      </pre>
    </section>
  );
}
