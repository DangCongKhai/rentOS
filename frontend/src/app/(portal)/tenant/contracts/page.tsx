import { PortalComingSoon } from "@/components/portal-coming-soon";

export default function TenantContractsPage() {
  return (
    <PortalComingSoon
      portalName="CỔNG CƯ DÂN"
      pageTitle="Căn hộ và hợp đồng"
      description="Xem chi tiết các hợp đồng thuê nhà điện tử, phụ lục gia hạn và lịch sử thanh toán tiền phòng."
      backHref="/tenant"
      backLabel="Về Trang chính"
    />
  );
}
