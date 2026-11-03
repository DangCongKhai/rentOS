import { Suspense } from "react";
import { ListingEditor } from "../listing-editor";

export default function NewOwnerListingPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  return (
    <Suspense fallback={<p className="px-1 py-6 text-sm text-slate-500">Đang tải tin đăng…</p>}>
      <NewOwnerListingLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function NewOwnerListingLoader({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const { propertyId } = await searchParams;
  return <section className="mx-auto w-full max-w-5xl px-1 py-4 sm:px-2 sm:py-6"><ListingEditor propertyId={propertyId} /></section>;
}
