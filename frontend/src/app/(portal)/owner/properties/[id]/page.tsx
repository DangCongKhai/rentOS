import { Suspense } from "react";
import { PropertyEditor } from "../property-editor";

export default function OwnerPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="px-1 py-6 text-sm text-slate-500">
          Đang tải bất động sản…
        </p>
      }
    >
      <OwnerPropertyLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OwnerPropertyLoader({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab = tab === "units" || tab === "photos" ? tab : "overview";
  return <PropertyEditor propertyId={id} tab={initialTab} />;
}
