"use client";

import { AllNotifications } from "@/components/all-notifications";

export default function NotificationsPage() {
  return (
    <section
      aria-labelledby="all-notifications-title"
      className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"
    >
      <AllNotifications />
    </section>
  );
}
