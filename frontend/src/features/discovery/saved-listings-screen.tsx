"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getFavouritePage, type FavouritePage } from "@/lib/favourites-api";
import { ApiError } from "@/lib/auth-api";
import { DiscoverySidebar } from "./discovery-sidebar";
import { FavouriteButton, useFavourites } from "./favourites-provider";
import { ListingCardView } from "./listing-card";

const control = "min-h-11 rounded-lg border border-border-default bg-surface-card px-3 text-sm text-heading";

export function SavedListingsScreen() {
  const params = useSearchParams();
  const selected = params.get("move_in_date") ?? "";
  const moveInDate = /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : "";
  const favourites = useFavourites();

  return (
    <div className="flex min-h-[calc(100vh-75px)] flex-col bg-surface-app md:flex-row">
      <DiscoverySidebar active="saved" moveInDate={moveInDate} />
      <section className="min-w-0 flex-1 space-y-4 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-secondary">Trang của bạn / Yêu thích</p>
            <h1 className="mt-1 text-[30px] font-bold tracking-tight text-heading">Yêu thích</h1>
            <p className="text-secondary">Lưu lại những căn hộ phù hợp để tiện xem lại và liên hệ.</p>
          </div>
          <Link href="/listings" className="inline-flex min-h-11 items-center rounded-lg bg-action-primary px-4 font-semibold text-white">→ Tìm thêm căn hộ</Link>
        </header>
        {favourites?.authStatus === "loading" && <p role="status" className="text-secondary">Đang tải Yêu thích…</p>}
        {favourites?.authStatus === "guest" && (
          <div className="space-y-3 rounded-2xl border border-border-default bg-surface-card p-6">
            <h2 className="text-lg font-semibold text-heading">Đăng nhập để xem tin đã lưu</h2>
            <p className="text-secondary">Danh sách yêu thích được lưu riêng cho tài khoản của bạn.</p>
            <button type="button" className={control + " font-semibold text-link"} onClick={favourites.prompt}>Đăng nhập</button>
          </div>
        )}
        {favourites?.accountId && (
          <SavedListings key={favourites.accountId + ":" + moveInDate} accountId={favourites.accountId} initialDate={moveInDate}
            revision={favourites.state.revision} count={favourites.state.status === "ready" ? favourites.state.ids.size : null} />
        )}
      </section>
    </div>
  );
}

function SavedListings({ accountId, initialDate, revision, count }: { accountId: string; initialDate: string; revision: number; count: number | null }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [moveInDate, setMoveInDate] = useState(initialDate);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: FavouritePage; error?: number }>();
  const key = [query, sort, moveInDate, page, retry, revision].join(":");
  const current = result?.key === key ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), sort });
    if (query) params.set("search", query);
    if (moveInDate) params.set("move_in_date", moveInDate);

    void getFavouritePage(accountId, params, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (page > data.last_page) setPage(data.last_page);
      else setResult({ key, data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof ApiError ? error.status : 0 });
    });

    return () => controller.abort();
  }, [accountId, key, page, sort, query, moveInDate]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  const data = current?.data;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-4">
        <p className="font-semibold text-link">{count === null ? "Danh sách đã lưu" : "Tất cả (" + count + ")"}</p>
        <div className="flex flex-wrap gap-2">
          <form className="flex flex-wrap gap-2" onSubmit={applySearch}>
            <input className={control + " min-w-0 sm:w-64"} value={search} onChange={(event) => setSearch(event.target.value)}
              maxLength={120} type="search" placeholder="Tìm trong danh sách đã lưu" aria-label="Tìm trong danh sách đã lưu" />
            <button type="submit" className={control + " font-semibold text-link"}>Tìm</button>
          </form>
          <select className={control} aria-label="Sắp xếp" value={sort}
            onChange={(event) => { setSort(event.target.value); setPage(1); }}>
            <option value="newest">Sắp xếp: Mới lưu gần đây</option>
            <option value="oldest">Sắp xếp: Lưu lâu nhất</option>
          </select>
          <label className={control + " inline-flex items-center gap-2"}>
            Ngày dọn vào
            <input type="date" value={moveInDate} className="min-w-0 text-secondary"
              onChange={(event) => { setMoveInDate(event.target.value); setPage(1); }} />
          </label>
        </div>
      </div>
      {moveInDate && <p className="text-sm text-secondary">Tình trạng trống cập nhật theo ngày thuê bạn đã chọn.</p>}
      {!current && <p role="status" className="text-secondary">Đang tải tin đã lưu…</p>}
      {current?.error !== undefined && (
        <div className="space-y-3 rounded-2xl border border-border-default bg-surface-card p-6">
          <p role="alert">{current.error === 403 ? "Hãy xác minh email để sử dụng Yêu thích." : "Chưa tải được danh sách đã lưu."}</p>
          {current.error === 401 ? <Link href="/login" className="text-link underline">Đăng nhập lại</Link>
            : <button type="button" className={control} onClick={() => setRetry((value) => value + 1)}>Thử lại</button>}
        </div>
      )}
      {data && data.items.length === 0 && <p className="rounded-2xl border border-border-default bg-surface-card p-6 text-secondary">
        {query ? "Không tìm thấy tin phù hợp trong danh sách đã lưu." : "Chưa có tin yêu thích."}
      </p>}
      {data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map(({ property_id, listing }) => listing ? (
            <ListingCardView key={property_id} listing={{ ...listing, property_id }} savedPage
              href={"/listings/" + listing.id + (moveInDate ? "?move_in_date=" + encodeURIComponent(moveInDate) : "")} />
          ) : (
            <article key={property_id} className="overflow-hidden rounded-2xl border border-border-default bg-surface-card">
              <div className="relative grid aspect-video place-items-center bg-surface-brand-soft text-secondary">
                <span aria-hidden="true">Ảnh không khả dụng</span>
                <FavouriteButton propertyId={property_id} className="absolute top-3 right-3" />
              </div>
              <div className="space-y-1 p-4">
                <h2 className="font-semibold text-heading">Bất động sản không khả dụng</h2>
                <p className="text-sm text-secondary">Bạn vẫn có thể bỏ lưu mục này.</p>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && data.last_page > 1 && (
        <nav aria-label="Phân trang Yêu thích" className="flex items-center justify-end gap-3">
          <button type="button" className={control} disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
          <span className="text-secondary">Trang {page}/{data.last_page}</span>
          <button type="button" className={control} disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Sau</button>
        </nav>
      )}
    </>
  );
}
