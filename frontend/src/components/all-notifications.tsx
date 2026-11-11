"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, type InboxNotification } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import {
  loadNotificationPage,
  markHeldNotificationRead,
  useNotificationInbox,
  type HeldInbox,
} from "@/lib/notification-inbox";
import { FilterTab, InboxBody } from "./notification-inbox";

type Filter = "all" | "unread";

export function AllNotifications() {
  const router = useRouter();
  const { user, status } = useAuth();
  const owner = useNotificationInbox(user?.id, "OWNER");
  const tenant = useNotificationInbox(user?.id, "TENANT");
  const admin = useNotificationInbox(
    user?.is_admin ? user.id : undefined,
    "ADMIN",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const inboxes = user?.is_admin ? [owner, tenant, admin] : [owner, tenant];
  const items = inboxes
    .flatMap((inbox) => inbox.items)
    .sort((left, right) => (
      right.created_at.localeCompare(left.created_at)
      || right.id.localeCompare(left.id)
    ));
  const visible = filter === "unread"
    ? items.filter((item) => item.read_at == null)
    : items;
  const unread = inboxes.reduce((sum, inbox) => sum + inbox.unread, 0);
  const page = Math.max(...inboxes.map((inbox) => inbox.page));
  const lastPage = Math.max(...inboxes.map((inbox) => inbox.lastPage));
  const loading = inboxes.some((inbox) => inbox.status === "loading");
  const failed = inboxes.find((inbox) => inbox.status === "error");

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [router, status]);

  async function markRead(item: InboxNotification) {
    if (!user) return;
    setPendingId(item.id);
    setActionError(null);
    try {
      await markHeldNotificationRead(user.id, item.audience, item.id);
    } catch (error) {
      setActionError(error instanceof ApiError
        ? error.message
        : "Không đánh dấu được thông báo. Vui lòng thử lại.");
    } finally {
      setPendingId(null);
    }
  }

  function openPage(nextPage: number) {
    if (!user) return;
    void loadNotificationPage(user.id, "OWNER", nextPage);
    void loadNotificationPage(user.id, "TENANT", nextPage);
    if (user.is_admin) {
      void loadNotificationPage(user.id, "ADMIN", nextPage);
    }
  }

  const inbox: HeldInbox = {
    userId: user?.id ?? "",
    audience: "OWNER",
    items,
    unread,
    page,
    lastPage,
    status: failed && items.length === 0
      ? "error"
      : loading && items.length === 0
        ? "loading"
        : "ready",
    error: failed?.error ?? null,
  };

  if (status !== "authenticated") {
    return (
      <div
        className={
          "h-20 animate-pulse rounded-2xl border border-slate-200 bg-white"
        }
        aria-busy="true"
        aria-label="Đang tải thông báo"
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1
          id="all-notifications-title"
          className={
            "text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          }
        >
          Thông báo
        </h1>
      </div>
      <div className="mb-4 flex items-center gap-6 border-b border-slate-200">
        <FilterTab
          selected={filter === "all"}
          onSelect={() => setFilter("all")}
          label="Tất cả"
        />
        <FilterTab
          selected={filter === "unread"}
          onSelect={() => setFilter("unread")}
          label="Chưa đọc"
          count={unread}
        />
      </div>
      <InboxBody
        inbox={inbox}
        visible={visible}
        filter={filter}
        pendingId={pendingId}
        actionError={actionError}
        onRetry={() => openPage(page)}
        onMarkRead={(id) => {
          const item = items.find((entry) => entry.id === id);
          if (item) void markRead(item);
        }}
        onPage={openPage}
        showAudience
      />
    </div>
  );
}
