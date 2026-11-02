import Link from "next/link";
import { useState } from "react";
import { toListingSearchParams, type ListingSearchState } from "./listing-search-params";

const emptyState: ListingSearchState = {
  location: "",
  moveInDate: "",
  minRent: "",
  maxRent: "",
  unitKind: "",
  bedrooms: "",
  bathrooms: "",
  occupants: "",
  amenities: [],
  pets: "",
  page: 1,
};

export function ListingSearchForm() {
  const [location, setLocation] = useState("");
  const href = `/listings?${toListingSearchParams({ ...emptyState, location }).toString()}`;

  return (
    <form className="rounded-[20px] bg-white/85 p-8 text-[#091216] shadow-[0_0_15px_rgba(0,0,0,0.45)] backdrop-blur-sm" aria-label="Tìm nhà">
      <h2 className="text-[30px] font-semibold leading-tight tracking-[-1.2px]">Tìm nơi gọi là nhà</h2>
      <p className="mt-2 text-xl tracking-[-0.4px]">Khám phá nơi ở phù hợp với bạn.</p>
      <label className="mt-8 grid gap-2 text-base">
        Địa điểm
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="min-h-11 border-b border-[#66a3bf] bg-transparent px-1 text-sm outline-none"
          placeholder="Thành phố, phường hoặc đường"
          autoComplete="off"
        />
      </label>
      <Link
        href={href}
        className="mt-8 inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#3368a0] px-4 text-base font-medium text-white"
      >
        Tìm nhà ngay!
        <span aria-hidden="true">→</span>
      </Link>
    </form>
  );
}
