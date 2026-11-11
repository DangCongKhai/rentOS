"use client";

import { NotificationInbox } from "@/components/notification-inbox";

export default function OwnerNotificationsPage() {
  return (
    <section aria-labelledby="owner-notifications-title">
      <NotificationInbox
        audience="OWNER"
        headingId="owner-notifications-title"
      />
    </section>
  );
}
