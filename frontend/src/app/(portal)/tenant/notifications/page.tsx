import { PortalComingSoon } from "@/components/portal-coming-soon";

export default function TenantNotificationsPage() {
  return (
    <PortalComingSoon
      portalName="CỔNG CƯ DÂN"
      pageTitle="Thông báo"
      description="Trung tâm cập nhật các thông báo về hóa đơn điện nước, nhắc hạn thanh toán và tin nhắn từ ban quản lý."
      backHref="/tenant"
      backLabel="Về Trang chính"
    />
  );
}
