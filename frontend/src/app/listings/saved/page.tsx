import { Suspense } from "react";
import { SavedListingsScreen } from "@/features/discovery/saved-listings-screen";

export default function SavedListingsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-secondary" role="status">Đang tải Yêu thích…</p>}>
      <SavedListingsScreen />
    </Suspense>
  );
}
