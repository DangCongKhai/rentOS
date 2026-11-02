import { DiscoverySidebar } from "@/features/discovery/discovery-sidebar";

export default function SavedListingsPage() {
  return (
    <div className="flex min-h-[calc(100vh-75px)] bg-[#f0f4f7]">
      <DiscoverySidebar active="saved" />
      <div className="px-6 py-10">
        <h1 className="text-[28px] font-semibold text-[#091216]">Yêu thích</h1>
        <p className="mt-2 text-sm text-[#5b6676]">Chưa có tin yêu thích.</p>
      </div>
    </div>
  );
}
