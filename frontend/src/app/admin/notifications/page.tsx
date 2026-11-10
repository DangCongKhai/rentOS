"use client";

import { NotificationInbox } from "@/components/notification-inbox";

export default function AdminNotificationsPage() {
  return (
    <section aria-labelledby="admin-notifications-title">
      <NotificationInbox
        audience="ADMIN"
        headingId="admin-notifications-title"
        variant="admin"
      />
    </section>
  );
}