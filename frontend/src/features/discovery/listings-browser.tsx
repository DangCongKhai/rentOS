"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { DiscoverySidebar } from "./discovery-sidebar";
import { ListingCardView } from "./listing-card";
import { ListingFilters } from "./listing-filters";
import { ListingSearchValidationError, parseListingSearchParams, toListingSearchParams } from "./listing-search-params";
import { fetchAmenities, fetchListings, type AmenityCatalogItem, type ListingSearchResponse } from "./listings-api";
import type { ListingSearchState } from "./listing-search-params";

const emptySearch: ListingSearchState = {
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

export function paginationItems(current: number, lastPage: number): Array<number | "gap"> {
  const page = Math.min(Math.max(current, 1), lastPage);
  const wanted = lastPage <= 5
    ? Array.from({ length: lastPage }, (_, index) => index + 1)
    : page <= 4
      ? [1, 2, 3, 4, 5, lastPage]
      : page >= lastPage - 3
        ? [1, lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1, lastPage]
        : [1, page - 1, page, page + 1, lastPage];
  const numbers = [...new Set(wanted.filter((item) => item >= 1 && item <= lastPage))].sort((left, right) => left - right);
  const items: Array<number | "gap"> = [];
  numbers.forEach((item, index) => {
    if (index > 0 && item - numbers[index - 1] > 1) items.push("gap");
    items.push(item);
  });
  return items;
}

function parseSearchState(query: string): { state: ListingSearchState; error: string | null } {
  try {
    return { state: parseListingSearchParams(new URLSearchParams(query)), error: null };
  } catch (error) {
    const message = error instanceof ListingSearchValidationError ? error.message : "Bộ lọc tìm kiếm không hợp lệ.";
    return { state: emptySearch, error: message };
  }
}

function Pagination({
  current,
  lastPage,
  onSelect,
}: {
  current: number;
  lastPage: number;
  onSelect: (page: number) => void;
}) {
  return (
    <nav aria-label="Phân trang" className="flex w-fit items-center gap-1 justify-self-end rounded-full bg-surface-brand-soft px-2 py-1.5">
      <button
        type="button"
        aria-label="Trang trước"
        disabled={current <= 1}
        className="inline-flex size-9 items-center justify-center rounded-full text-heading disabled:text-muted"
        onClick={() => onSelect(current - 1)}
      >
        <PageChevron direction="left" />
      </button>
      {paginationItems(current, lastPage).map((item, index) => {
        if (item === "gap") {
          return <span key={`gap-${index}`} className="px-1 text-sm text-muted" aria-hidden="true">…</span>;
        }
        const selected = item === current;
        return (
          <button
            key={item}
            type="button"
            aria-current={selected ? "page" : undefined}
            className={`inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold ${selected ? "bg-action-primary text-white" : "text-heading hover:bg-surface-card"}`}
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Trang sau"
        disabled={current >= lastPage}
        className="inline-flex size-9 items-center justify-center rounded-full text-heading disabled:text-muted"
        onClick={() => onSelect(current + 1)}
      >
        <PageChevron direction="right" />
      </button>
    </nav>
  );
}

function PageChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path
        d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ListingsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ query: string; status: "ready" | "error"; body: ListingSearchResponse | null } | null>(null);
  const [amenities, setAmenities] = useState<AmenityCatalogItem[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const parsed = parseSearchState(query);
  const state = parsed.state;
  const status = parsed.error ? "error" : result?.query === query ? result.status : "loading";

  useEffect(() => {
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAmenities(controller.signal)
      .then((body) => {
        if (!controller.signal.aborted) setAmenities(body.data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (parsed.error) return;
    const controller = new AbortController();
    fetchListings(toListingSearchParams(parseListingSearchParams(new URLSearchParams(query))), controller.signal)
      .then((body) => {
        if (controller.signal.aborted) return;
        setResult({ query, status: "ready", body });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setResult({ query, status: "error", body: null });
      });
    return () => controller.abort();
  }, [query, attempt, parsed.error]);

  const body = result?.body;
  const heading = body?.meta.result_label
    ?? (state.location ? `${body?.meta.total ?? 0} tin đăng tại ${state.location}` : `${body?.meta.total ?? 0} tin đăng`);

  return (
    <div className="fixed inset-x-0 top-[75px] bottom-0 flex overflow-hidden bg-[#f0f4f7]">
      <DiscoverySidebar active="search" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative z-20 shrink-0 grid gap-4 px-4 pt-5 pb-4 lg:px-8">
          <ListingFilters
            query={query}
            amenities={amenities}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
          />
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.4px] text-[#091216]">{state.location ? `Nhà cho thuê tại ${state.location}` : "Nhà cho thuê"}</h1>
            <p className="text-sm text-[#5b6676]">{status === "ready" ? heading : "Đang tìm phòng..."}</p>
          </div>
          <p className="text-sm text-muted">Tình trạng trống chỉ mang tính chỉ báo, căn có thể được người khác giữ chỗ ngay sau khi bạn tìm kiếm.</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-8 lg:px-8">
      {status === "loading" ? <LoadingScreen className="min-h-0 flex-1" /> : null}
      <div className="grid content-start gap-4">
      {status === "error" ? (
        <div role="alert" className="grid gap-3">
          <p>{parsed.error ?? "Không tải được danh sách. Thử lại."}</p>
          {parsed.error ? null : (
            <button type="button" className="min-h-11 w-fit rounded-xl border px-4" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>
              Thử lại
            </button>
          )}
        </div>
      ) : null}
      {status === "ready" && body?.data.length === 0 ? <p>Không có tin phù hợp.</p> : null}
      {status === "ready" && body ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {body.data.map((listing) => (
            <ListingCardView key={listing.id} listing={listing} href={`/listings/${listing.id}?${query}`} />
          ))}
        </div>
      ) : null}
      {status === "ready" && body && body.meta.last_page > 1 ? (
        <Pagination
          current={body.meta.current_page}
          lastPage={body.meta.last_page}
          onSelect={(page) => {
            const params = toListingSearchParams({ ...state, page });
            const text = params.toString();
            router.replace(text ? `/listings?${text}` : "/listings");
          }}
        />
      ) : null}
      </div>
        </div>
      </div>
    </div>
  );
}
