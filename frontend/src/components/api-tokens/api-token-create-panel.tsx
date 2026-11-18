"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/http/client";
import { createPersonalAccessToken } from "@/lib/tokens/api";
import { saveNewlyCreatedToken } from "@/lib/tokens/new-token-secret";
import { tokenAbilities, type TokenAbility } from "@/lib/tokens/types";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100";
const abilityLabels: Record<TokenAbility, string> = {
  "account:read": "Đọc thông tin tài khoản",
  "favourites:read": "Xem danh sách yêu thích",
  "rental-requests:read": "Đọc yêu cầu gửi đến bất động sản của bạn",
};
type ExpirationChoice = "1" | "7" | "30" | "custom" | "never";

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function tomorrow(): string {
  return daysFromToday(1);
}

export function ApiTokenCreatePanel() {
  const router = useRouter();
  const [abilities, setAbilities] = useState<TokenAbility[]>(["account:read"]);
  const [expirationChoice, setExpirationChoice] = useState<ExpirationChoice>("30");
  const [customExpiration, setCustomExpiration] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const expiresAt = expirationChoice === "never"
      ? null
      : expirationChoice === "custom"
        ? customExpiration
        : daysFromToday(Number(expirationChoice));

    try {
      const result = await createPersonalAccessToken({
        name: String(form.get("name") ?? "").trim(),
        abilities,
        expires_at: expiresAt,
      });
      saveNewlyCreatedToken({
        name: result.data.name,
        plainTextToken: result.plain_text_token,
      });
      router.push("/api-tokens");
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setFieldErrors(cause.errors);
      } else {
        setError("Không thể tạo mã truy cập.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link href="/api-tokens" className="text-sm font-semibold text-[#3368a0] hover:underline">← Quay lại mã truy cập API</Link>
      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Bảo mật</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Tạo mã truy cập API</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Chọn quyền tối thiểu cần thiết. Có thể thu hồi mã bất cứ lúc nào trong danh sách.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

      <form onSubmit={submit} className="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">Thông tin mã</h2>
        <label className="block text-sm font-semibold text-slate-700">Tên mã
          <input className={fieldClass} name="name" required minLength={1} maxLength={100} placeholder="Ví dụ: Postman trên máy cá nhân" aria-invalid={Boolean(fieldErrors.name)} />
          {fieldErrors.name?.[0] && <span className="mt-1 block text-xs text-rose-700">{fieldErrors.name[0]}</span>}
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-700">Quyền được cấp</legend>
          {tokenAbilities.map((ability) => (
            <label key={ability} className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={abilities.includes(ability)} onChange={(event) => setAbilities((current) => event.target.checked ? [...current, ability] : current.filter((item) => item !== ability))} />
              <span>{abilityLabels[ability]} <code className="text-xs text-slate-500">({ability})</code></span>
            </label>
          ))}
          {fieldErrors.abilities?.[0] && <span className="block text-xs text-rose-700">{fieldErrors.abilities[0]}</span>}
        </fieldset>

        <label className="block text-sm font-semibold text-slate-700">Thời hạn
          <select className={fieldClass} value={expirationChoice} onChange={(event) => setExpirationChoice(event.target.value as ExpirationChoice)}>
            <option value="1">1 ngày</option>
            <option value="7">7 ngày</option>
            <option value="30">30 ngày</option>
            <option value="custom">Ngày tùy chọn</option>
            <option value="never">Không hết hạn</option>
          </select>
        </label>
        {expirationChoice === "custom" && (
          <label className="block text-sm font-semibold text-slate-700">Ngày hết hạn
            <input className={fieldClass} type="date" min={tomorrow()} value={customExpiration} onChange={(event) => setCustomExpiration(event.target.value)} required />
            {fieldErrors.expires_at?.[0] && <span className="mt-1 block text-xs text-rose-700">{fieldErrors.expires_at[0]}</span>}
          </label>
        )}
        {expirationChoice === "never" && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Mã này sẽ tiếp tục hoạt động cho đến khi bạn thu hồi nó.</p>}
        <button className="min-h-11 rounded-lg bg-[#3368a0] px-5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || abilities.length === 0 || (expirationChoice === "custom" && !customExpiration)} type="submit">{busy ? "Đang tạo…" : "Tạo mã truy cập"}</button>
      </form>
    </section>
  );
}
