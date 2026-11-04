import { PortalComingSoon } from "@/components/portal-coming-soon";

export default function TenantReportsPage() {
  return (
    <PortalComingSoon
      portalName="CỔNG CƯ DÂN"
      pageTitle="Báo cáo của tôi"
      description="Gửi và theo dõi tiến độ xử lý các sự cố hỏng hóc, yêu cầu bảo trì thiết bị và dịch vụ tiện ích."
      backHref="/tenant"
      backLabel="Về Trang chính"
    />
  );
}
