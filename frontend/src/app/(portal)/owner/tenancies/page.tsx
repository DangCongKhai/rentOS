import { PortalComingSoon } from "@/components/portal-coming-soon";

export default function OwnerTenanciesPage() {
  return (
    <PortalComingSoon
      portalName="CỔNG CHỦ NHÀ"
      pageTitle="Kỳ thuê và hợp đồng"
      description="Quản lý thời hạn các hợp đồng thuê, theo dõi chu kỳ thanh toán và xử lý thủ tục trả phòng."
      backHref="/owner"
      backLabel="Về Tổng quan"
    />
  );
}
