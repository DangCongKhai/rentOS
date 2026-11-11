import { Suspense } from "react";
import { OwnerRequestsScreen } from "../owner-requests-screen";

async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerRequestsScreen requestId={id} />;
}

export default function OwnerRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status" className="text-secondary">Đang tải yêu cầu thuê…</p>}>
      <RequestDetail params={params} />
    </Suspense>
  );
}
