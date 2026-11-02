import type { Metadata } from "next";
import { GuideScreen } from "@/features/guide/guide-screen";

export const metadata: Metadata = {
  title: "Hướng dẫn — rentOS",
  description: "Xem cách tìm nhà, gửi yêu cầu thuê và quản lý hợp đồng trên rentOS.",
};

export default function GuidePage() {
  return <GuideScreen />;
}
