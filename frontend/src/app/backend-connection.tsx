"use client";

import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CheckResult = {
  ok: boolean;
  message: string;
};

export function BackendConnection() {
  const [result, setResult] = useState<CheckResult>({
    ok: false,
    message: "Not checked yet.",
  });
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);

    try {
      const response = await fetch("/api/backend-health");
      const body: unknown = await response.json();
      const backend =
        typeof body === "object" && body !== null && "body" in body
          ? body.body
          : null;
      const status =
        typeof backend === "object" &&
        backend !== null &&
        "status" in backend &&
        typeof backend.status === "string"
          ? backend.status
          : null;

      setResult(
        response.ok && status
          ? { ok: true, message: `Connected. Backend status: ${status}.` }
          : {
              ok: false,
              message: `Backend did not answer. HTTP ${response.status}.`,
            },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Request failed.";
      setResult({
        ok: false,
        message: `Cannot reach the backend at ${apiUrl}. Start it with php artisan serve. ${detail}`,
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-black/8 p-4 dark:border-white/15">
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        Backend connection
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Checks <code className="font-mono">{apiUrl}/api/health</code> from this
        page.
      </p>
      <button
        type="button"
        onClick={checkConnection}
        disabled={checking}
        className="h-10 w-fit rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
      >
        {checking ? "Checking..." : "Check backend"}
      </button>
      <p
        className={
          result.ok
            ? "text-sm text-green-700 dark:text-green-400"
            : "text-sm text-zinc-700 dark:text-zinc-300"
        }
      >
        {result.message}
      </p>
    </section>
  );
}
