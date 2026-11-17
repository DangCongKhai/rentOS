export type NotificationAudience = "ADMIN" | "TENANT" | "OWNER";

export type InboxNotification = {
  id: string;
  actor_id: string | null;
  audience: NotificationAudience;
  title: string;
  body: string;
  resource_type: string | null;
  resource_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPageMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type NotificationPage = {
  data: InboxNotification[];
  unread_count: number;
  unread_by_audience: Partial<Record<NotificationAudience, number>>;
  meta: NotificationPageMeta;
};
