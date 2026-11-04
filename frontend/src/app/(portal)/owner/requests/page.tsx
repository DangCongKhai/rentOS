import { PortalComingSoon } from "@/components/portal-coming-soon";

export default function OwnerRequestsPage() {
  return (
    <PortalComingSoon
      portalName="CỔNG CHỦ NHÀ"
      pageTitle="Yêu cầu thuê"
      description="Xét duyệt hồ sơ người thuê, lịch hẹn xem phòng và chấp thuận các đề xuất hợp đồng mới."
      backHref="/owner"
      backLabel="Về Tổng quan"
    />
  );
}
