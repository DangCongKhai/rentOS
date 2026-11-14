"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  listNotifications,
  markNotificationRead,
  type InboxNotification,
  type NotificationAudience,
  type NotificationPage,
} from "./auth-api";
import { getQueryClient } from "./query-provider";

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

type AudienceInput = NotificationAudience | readonly NotificationAudience[];

function normalizeAudiences(audience: AudienceInput): NotificationAudience[] {
  const values = Array.isArray(audience) ? [...audience] : [audience];
  return values.sort();
}

function cursorKey(userId: string, audiences: readonly NotificationAudience[]) {
  return ["notifications-page", userId, audiences] as const;
}

function listKey(
  userId: string,
  audiences: readonly NotificationAudience[],
  page: number,
) {
  return ["notifications", userId, audiences, page] as const;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Không tải được thông báo. Vui lòng thử lại.";
}

export function clearHeldNotifications(): void {
  if (typeof window === "undefined") return;
  const client = getQueryClient();
  client.removeQueries({ queryKey: ["notifications"] });
  client.removeQueries({ queryKey: ["notifications-page"] });
}

export function useNotificationUnread(userId: string | undefined): number {
  return useNotificationInbox(userId, ["OWNER", "TENANT"]).unread;
}

export function useNotificationInbox(
  userId: string | undefined,
  audience: AudienceInput,
): HeldInbox {
  const audiences = normalizeAudiences(audience);
  const cursor = useQuery({
    queryKey: cursorKey(userId ?? "", audiences),
    queryFn: () => 1,
    enabled: Boolean(userId),
    initialData: 1,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const page = cursor.data ?? 1;
  const list = useQuery({
    queryKey: userId
      ? listKey(userId, audiences, page)
      : ["notifications", "signed-out"],
    queryFn: () => listNotifications(audiences, page),
    enabled: Boolean(userId),
  });

  if (!userId) return emptyInbox;

  if (list.isError && !list.data) {
    return {
      userId,
      audience: audiences[0] ?? "OWNER",
      items: [],
      unread: 0,
      page,
      lastPage: 1,
      status: "error",
      error: errorMessage(list.error),
    };
  }

  if (!list.data) {
    return {
      userId,
      audience: audiences[0] ?? "OWNER",
      items: [],
      unread: 0,
      page,
      lastPage: 1,
      status: "loading",
      error: null,
    };
  }

  return {
    userId,
    audience: audiences[0] ?? "OWNER",
    items: list.data.data,
    unread: list.data.unread_count,
    page: list.data.meta.current_page,
    lastPage: list.data.meta.last_page,
    status: "ready",
    error: null,
  };
}

export async function loadNotificationPage(
  userId: string,
  audience: AudienceInput,
  page: number,
): Promise<void> {
  const audiences = normalizeAudiences(audience);
  const client = getQueryClient();
  client.setQueryData(cursorKey(userId, audiences), page);
  try {
    await client.fetchQuery({
      queryKey: listKey(userId, audiences, page),
      queryFn: () => listNotifications(audiences, page),
    });
  } catch {
    // The inbox query keeps the error for the page that just failed.
  }
}

export async function markHeldNotificationRead(
  userId: string,
  audience: AudienceInput,
  id: string,
): Promise<void> {
  const updated = await markNotificationRead(id);
  const client = getQueryClient();
  const audiences = normalizeAudiences(audience);
  const pages = client.getQueriesData<NotificationPage>({
    queryKey: ["notifications", userId],
  });

  for (const [key, page] of pages) {
    const keyAudiences = key[2];
    const overlaps = Array.isArray(keyAudiences)
      && audiences.some((value) => keyAudiences.includes(value));
    if (!page || !overlaps) continue;

    const previous = page.data.find((item) => item.id === id);
    if (!previous) continue;
    const becameRead = previous.read_at == null && updated.read_at != null;
    client.setQueryData<NotificationPage>(key, {
      ...page,
      data: page.data.map((item) => (item.id === id ? updated : item)),
      unread_count: becameRead
        ? Math.max(0, page.unread_count - 1)
        : page.unread_count,
    });
  }

  await client.invalidateQueries({ queryKey: ["notifications", userId] });
}
