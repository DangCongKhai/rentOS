import { Suspense } from "react";
import { UnitEditor } from "../../../unit-editor";

export default function OwnerUnitPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="px-1 py-6 text-sm text-slate-500">Đang tải phòng…</p>
      }
    >
      <OwnerUnitLoader params={params} />
    </Suspense>
  );
}

async function OwnerUnitLoader({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const { id, unitId } = await params;
  return <UnitEditor propertyId={id} unitId={unitId} />;
}
