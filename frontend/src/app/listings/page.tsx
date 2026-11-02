import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { ListingsBrowser } from "@/features/discovery/listings-browser";

export default function ListingsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ListingsBrowser />
    </Suspense>
  );
}
