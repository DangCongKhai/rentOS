"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  ApiError,
  listNotifications,
  markNotificationRead,
  type InboxNotification,
  type NotificationAudience,
} from "./auth-api";

export type HeldInbox = {
  userId: string;
  audience: NotificationAudience;
  items: InboxNotification[];
  unread: number;
  page: number;
  lastPage: number;
  status: "loading" | "ready" | "error";
  error: string | null;
};

const slots = new Map<string, HeldInbox>();
const listeners = new Set<() => void>();
const inflight = new Set<string>();
let epoch = 0;

const emptyInbox: HeldInbox = {
  userId: "",
  audience: "OWNER",
  items: [],
  unread: 0,
  page: 1,
  lastPage: 1,
  status: "loading",
  error: null,
};

function slotKey(userId: string, audience: NotificationAudience): string {
  return `${userId}:${audience}`;
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readSlot(
  userId: string | undefined,
  audience: NotificationAudience,
): HeldInbox {
  if (!userId) return emptyInbox;
  return slots.get(slotKey(userId, audience)) ?? emptyInbox;
}

export function clearHeldNotifications(): void {
  epoch += 1;
  inflight.clear();
  slots.clear();
  emit();
}

export function useNotificationUnread(
  userId: string | undefined,
  includeAdmin: boolean,
): number {
  const owner = useNotificationInbox(userId, "OWNER");
  const tenant = useNotificationInbox(userId, "TENANT");
  const admin = useNotificationInbox(
    includeAdmin ? userId : undefined,
    "ADMIN",
  );

  return owner.unread + tenant.unread + (includeAdmin ? admin.unread : 0);
}

export function useNotificationInbox(
  userId: string | undefined,
  audience: NotificationAudience,
): HeldInbox {
  const inbox = useSyncExternalStore(
    subscribe,
    () => readSlot(userId, audience),
    () => emptyInbox,
  );

  useEffect(() => {
    if (!userId) return;
    if (slots.has(slotKey(userId, audience))) return;
    void loadNotificationPage(userId, audience, 1);
  }, [userId, audience]);

  return inbox;
}

export async function loadNotificationPage(
  userId: string,
  audience: NotificationAudience,
  page: number,
): Promise<void> {
  const key = slotKey(userId, audience);
  if (inflight.has(key)) return;

  const seen = epoch;
  const previous = slots.get(key);
  inflight.add(key);
  slots.set(key, {
    userId,
    audience,
    items: previous?.items ?? [],
    unread: previous?.unread ?? 0,
    page,
    lastPage: previous?.lastPage ?? 1,
    status: "loading",
    error: null,
  });
  emit();

  try {
    const result = await listNotifications(audience, page);
    if (seen !== epoch) return;
    slots.set(key, {
      userId,
      audience,
      items: result.data,
      unread: result.unread_count,
      page: result.meta.current_page,
      lastPage: result.meta.last_page,
      status: "ready",
      error: null,
    });
    emit();
  } catch (error) {
    if (seen !== epoch) return;
    const message = error instanceof ApiError
      ? error.message
      : "Không tải được thông báo. Vui lòng thử lại.";
    slots.set(key, {
      userId,
      audience,
      items: [],
      unread: previous?.unread ?? 0,
      page,
      lastPage: previous?.lastPage ?? 1,
      status: "error",
      error: message,
    });
    emit();
  } finally {
    inflight.delete(key);
  }
}

export async function markHeldNotificationRead(
  userId: string,
  audience: NotificationAudience,
  id: string,
): Promise<void> {
  const seen = epoch;
  const updated = await markNotificationRead(id);
  if (seen !== epoch) return;

  const key = slotKey(userId, audience);
  const current = slots.get(key);
  if (!current || current.userId !== userId) return;

  const previous = current.items.find((item) => item.id === id);
  const becameRead = previous?.read_at == null && updated.read_at != null;
  slots.set(key, {
    ...current,
    items: current.items.map((item) => (
      item.id === id ? updated : item
    )),
    unread: becameRead
      ? Math.max(0, current.unread - 1)
      : current.unread,
  });
  emit();
}
