import { request } from "@/lib/http/client";
import type { InboxNotification, NotificationAudience, NotificationPage } from "./types";

export async function listNotifications(
  audience: NotificationAudience | readonly NotificationAudience[],
  page = 1,
): Promise<NotificationPage> {
  const params = new URLSearchParams({ page: String(page) });
  const audiences = Array.isArray(audience) ? audience : [audience];
  if (audiences.length === 1) {
    params.set("audience", audiences[0]);
  } else {
    for (const value of audiences) {
      params.append("audience[]", value);
    }
  }
  return request<NotificationPage>(`/api/v1/notifications?${params.toString()}`);
}

export async function markNotificationRead(
  id: string,
): Promise<InboxNotification> {
  return request<InboxNotification>(
    `/api/v1/notifications/${id}/read`,
    { method: "POST", body: "{}" },
  );
}
