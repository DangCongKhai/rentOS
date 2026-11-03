import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hàng đợi kiểm duyệt — rentOS",
};

export default function ReviewQueueLayout({ children }: { children: ReactNode }) {
  return children;
}
