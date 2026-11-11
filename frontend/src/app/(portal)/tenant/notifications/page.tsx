"use client";

import { NotificationInbox } from "@/components/notification-inbox";

export default function TenantNotificationsPage() {
  return (
    <section aria-labelledby="tenant-notifications-title">
      <NotificationInbox
        audience="TENANT"
        headingId="tenant-notifications-title"
      />
    </section>
  );
}
