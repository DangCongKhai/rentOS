import { Suspense } from "react";
import { TenantRequestsScreen } from "../tenant-requests-screen";

async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TenantRequestsScreen requestId={id} />;
}

export default function TenantRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status" className="text-secondary">Đang tải yêu cầu thuê…</p>}>
      <RequestDetail params={params} />
    </Suspense>
  );
}
