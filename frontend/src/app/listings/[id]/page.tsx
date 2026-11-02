import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { ListingDetailScreen } from "@/features/discovery/listing-detail-screen";

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ListingDetailLoader params={params} />
    </Suspense>
  );
}

async function ListingDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingDetailScreen id={id} />;
}
