"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, type InboxNotification } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import {
  loadNotificationPage,
  markHeldNotificationRead,
  useNotificationInbox,
} from "@/lib/notification-inbox";
import { FilterTab, InboxBody } from "./notification-inbox";

type Filter = "all" | "unread";

const combinedAudiences = ["OWNER", "TENANT"] as const;

export function AllNotifications() {
  const router = useRouter();
  const { user, status } = useAuth();
  const inbox = useNotificationInbox(user?.id, combinedAudiences);
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const items = inbox.items;
  const visible = filter === "unread"
    ? items.filter((item) => item.read_at == null)
    : items;

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
    void loadNotificationPage(user.id, combinedAudiences, nextPage);
  }

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
          count={inbox.unread}
        />
      </div>
      <InboxBody
        inbox={inbox}
        visible={visible}
        filter={filter}
        pendingId={pendingId}
        actionError={actionError}
        onRetry={() => openPage(inbox.page)}
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
