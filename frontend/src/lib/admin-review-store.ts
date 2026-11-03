"use client";

import { useMemo, useSyncExternalStore } from "react";
import { reviewQueuePreview } from "./admin-review-preview";
import { applyPreviewDecision, parsePreviewDecisions, type PreviewDecisions, type ReviewDecisionInput } from "./admin-review-decision";

const storageKey = "rentos.admin-review-preview.v1";
const changeEvent = "rentos-admin-review-preview-change";

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, listener);
  };
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(storageKey) ?? "{}";
  } catch {
    return "storage-unavailable";
  }
}

function getServerSnapshot(): null { return null; }

export function useAdminReviewPreview() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const snapshot = useMemo<{ decisions: PreviewDecisions; storageError: string | null }>(() => {
    try {
      return { decisions: parsePreviewDecisions(raw), storageError: null };
    } catch {
      return { decisions: {}, storageError: "Không đọc được dữ liệu mẫu đã lưu. Hãy cho phép lưu trữ trong trình duyệt hoặc khôi phục dữ liệu mẫu." };
    }
  }, [raw]);
  const items = useMemo(() => reviewQueuePreview.map((item) => {
    const decision = snapshot.decisions[item.id];
    return decision ? {
      ...item,
      status: decision.status,
      initialApprovedAt: decision.status === "APPROVED" ? decision.decidedAt : null,
    } : item;
  }), [snapshot.decisions]);

  return { ...snapshot, items, ready: raw !== null };
}

export async function savePreviewDecision(input: ReviewDecisionInput): Promise<void> {
  const commit = () => {
    const latest = parsePreviewDecisions(window.localStorage.getItem(storageKey));
    const updated = applyPreviewDecision(latest, input);
    window.localStorage.setItem(storageKey, JSON.stringify(updated));
    window.dispatchEvent(new Event(changeEvent));
  };
  // Coordinates local demo tabs only; production decisions require the API transaction.
  if (navigator.locks) {
    await navigator.locks.request(storageKey, commit);
  } else {
    commit();
  }
}

export function resetReviewPreview(): void {
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(changeEvent));
}
