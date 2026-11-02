import Link from "next/link";

export function DiscoverySidebar({ active }: { active: "search" | "saved" }) {
  return (
    <nav aria-label="Khám phá" className="hidden w-[92px] shrink-0 flex-col items-center gap-1 border-r border-[#e1e7ed] bg-white px-2 py-3 md:flex">
      <Link href="/listings" className="flex w-[75px] flex-col items-center gap-1.5 py-3" aria-current={active === "search" ? "page" : undefined}>
        <span className={`flex h-11 w-[52px] items-center justify-center rounded-[14px] ${active === "search" ? "bg-[#eaf1f7] text-[#3368a0]" : "text-[#454e5c]"}`}>
          <SearchIcon />
        </span>
        <span className={`text-[13px] font-semibold ${active === "search" ? "text-[#3368a0]" : "text-[#454e5c]"}`}>Tìm kiếm</span>
      </Link>
      <Link href="/listings/saved" className="flex w-[75px] flex-col items-center gap-1.5 py-3" aria-current={active === "saved" ? "page" : undefined}>
        <span className={`flex h-11 w-[52px] items-center justify-center rounded-[14px] ${active === "saved" ? "bg-[#eaf1f7] text-[#3368a0]" : "text-[#454e5c]"}`}>
          <HeartIcon />
        </span>
        <span className={`text-[13px] font-semibold ${active === "saved" ? "text-[#3368a0]" : "text-[#454e5c]"}`}>Yêu thích</span>
      </Link>
    </nav>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19s-6.2-3.7-8.2-7.2C2.4 9.6 3.4 6.8 6.2 6.2 7.8 5.8 9.3 6.4 10.2 7.6L12 9.8l1.8-2.2c.9-1.2 2.4-1.8 4-1.4 2.8.6 3.8 3.4 2.4 5.6C18.2 15.3 12 19 12 19Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
