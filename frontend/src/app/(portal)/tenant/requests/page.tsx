import { PortalComingSoon } from "@/components/portal-coming-soon";

export default function TenantRequestsPage() {
  return (
    <PortalComingSoon
      portalName="CỔNG CƯ DÂN"
      pageTitle="Yêu cầu thuê"
      description="Quản lý và theo dõi tiến độ các yêu cầu thuê phòng, lịch xem nhà và phản hồi từ chủ nhà."
      backHref="/tenant"
      backLabel="Về Trang chính"
    />
  );
}
