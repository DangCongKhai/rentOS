import { PortalComingSoon } from "@/components/portal-coming-soon";

export default function OwnerNotificationsPage() {
  return (
    <PortalComingSoon
      portalName="CỔNG CHỦ NHÀ"
      pageTitle="Thông báo"
      description="Cập nhật nhanh các thông báo xác nhận thanh toán, cảnh báo gia hạn hợp đồng và tin nhắn mới."
      backHref="/owner"
      backLabel="Về Tổng quan"
    />
  );
}
