"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, type InboxNotification } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import {
  loadNotificationPage,
  markHeldNotificationRead,
  useNotificationInbox,
  type HeldInbox,
} from "@/lib/notification-inbox";

type Audience = "ADMIN" | "TENANT" | "OWNER";
type Filter = "all" | "unread";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
  const day = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);

  return `${time} ${day}`;
}

function listingHref(item: InboxNotification): string | null {
  if (item.resource_type !== "listing" || !item.resource_id) {
    return null;
  }

  return `/owner/listings/${item.resource_id}`;
}

export function NotificationInbox({
  audience,
  headingId,
  variant = "portal",
}: {
  audience: Audience;
  headingId: string;
  variant?: "portal" | "admin";
}) {
  const { user } = useAuth();
  const inbox = useNotificationInbox(user?.id, audience);
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const visible = filter === "unread"
    ? inbox.items.filter((item) => item.read_at == null)
    : inbox.items;

  async function markRead(id: string) {
    if (!user) return;
    setPendingId(id);
    setActionError(null);
    try {
      await markHeldNotificationRead(user.id, audience, id);
    } catch (error) {
      setActionError(error instanceof ApiError
        ? error.message
        : "Không đánh dấu được thông báo. Vui lòng thử lại.");
    } finally {
      setPendingId(null);
    }
  }

  function openPage(page: number) {
    if (!user) return;
    void loadNotificationPage(user.id, audience, page);
  }

  const headingClass = variant === "admin"
    ? "admin-pageHeading"
    : "mb-6";

  return (
    <div className={variant === "portal" ? "max-w-3xl" : undefined}>
      <div className={headingClass}>
        <h1
          id={headingId}
          className={variant === "admin"
            ? undefined
            : "text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight"}
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
        onMarkRead={markRead}
        onPage={openPage}
      />
    </div>
  );
}

export function FilterTab({
  selected,
  onSelect,
  label,
  count,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold ${
        selected
          ? "border-[#3368a0] text-slate-900"
          : "border-transparent text-slate-500"
      }`}
      onClick={onSelect}
    >
      {label}
      {count != null && count > 0 && (
        <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#3368a0] px-1.5 text-xs font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

export function InboxBody({
  inbox,
  visible,
  filter,
  pendingId,
  actionError,
  onRetry,
  onMarkRead,
  onPage,
  showAudience = false,
}: {
  inbox: HeldInbox;
  visible: InboxNotification[];
  filter: Filter;
  pendingId: string | null;
  actionError: string | null;
  onRetry: () => void;
  onMarkRead: (id: string) => void;
  onPage: (page: number) => void;
  showAudience?: boolean;
}) {
  if (inbox.status === "loading" && inbox.items.length === 0) {
    return (
      <div
        className="animate-pulse space-y-3"
        aria-busy="true"
        aria-label="Đang tải thông báo"
      >
        <div className="h-20 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-20 rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (inbox.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white px-6 py-10 text-center">
        <p className="mb-4 text-sm font-medium text-rose-600">{inbox.error}</p>
        <button
          type="button"
          className="inline-flex min-h-[42px] items-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800"
          onClick={onRetry}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-600">
          {filter === "unread"
            ? "Không có thông báo chưa đọc trên trang này."
            : "Bạn chưa có thông báo."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {actionError && (
        <p className="mb-3 text-sm font-medium text-rose-600" role="alert">
          {actionError}
        </p>
      )}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {visible.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            pending={pendingId === item.id}
            showAudience={showAudience}
            onMarkRead={() => onMarkRead(item.id)}
          />
        ))}
      </ul>
      {inbox.lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            className="font-semibold text-[#3368a0] disabled:text-slate-300"
            disabled={inbox.page <= 1 || inbox.status === "loading"}
            onClick={() => onPage(inbox.page - 1)}
          >
            Trang trước
          </button>
          <span className="text-slate-500">
            {inbox.page}/{inbox.lastPage}
          </span>
          <button
            type="button"
            className="font-semibold text-[#3368a0] disabled:text-slate-300"
            disabled={
              inbox.page >= inbox.lastPage || inbox.status === "loading"
            }
            onClick={() => onPage(inbox.page + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}

const audienceLabel: Record<Audience, string> = {
  OWNER: "Chủ nhà",
  TENANT: "Cư dân",
  ADMIN: "Quản trị",
};

function NotificationRow({
  item,
  pending,
  onMarkRead,
  showAudience = false,
}: {
  item: InboxNotification;
  pending: boolean;
  onMarkRead: () => void;
  showAudience?: boolean;
}) {
  const href = listingHref(item);
  const unread = item.read_at == null;

  return (
    <li className="flex gap-3 px-4 py-4 sm:px-5">
      <span
        className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
          unread ? "bg-[#3368a0]" : "bg-transparent"
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm text-slate-900 ${
            unread ? "font-bold" : "font-medium"
          }`}
        >
          {item.title}
        </p>
        {showAudience && (
          <p className="mt-1 text-xs font-semibold text-[#3368a0]">
            {audienceLabel[item.audience]}
          </p>
        )}
        <p className="mt-1 text-sm text-slate-600">{item.body}</p>
        <p className="mt-2 text-xs text-slate-400">
          {formatWhen(item.created_at)}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {unread && (
            <button
              type="button"
              className="text-sm font-semibold text-[#3368a0] disabled:text-slate-400"
              disabled={pending}
              onClick={onMarkRead}
            >
              {pending ? "Đang lưu…" : "Đánh dấu đã đọc"}
            </button>
          )}
          {href && (
            <Link
              href={href}
              className="text-sm font-semibold text-slate-700"
              onClick={() => {
                if (unread) onMarkRead();
              }}
            >
              Xem tin đăng
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
