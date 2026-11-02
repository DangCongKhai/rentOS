"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ListingCard } from "./listings-api";

const cardSizes = "(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw";

const kindLabels: Record<string, string> = {
  ROOM: "Phòng",
  STUDIO: "Studio",
  APARTMENT: "Căn hộ",
  APARTMENT_BUILDING: "Tòa nhà",
  HOUSE: "Nhà",
};

function millions(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`;
}

export function formatRent(min: string, max: string): string {
  if (min === max) return `từ ${millions(min)}/tháng`;
  return `từ ${millions(min)} – ${millions(max)}/tháng`;
}

function photoUrls(listing: ListingCard): string[] {
  if (listing.image_urls.length > 0) return listing.image_urls;
  return listing.cover_url ? [listing.cover_url] : [];
}

export function ListingCardView({ listing, href }: { listing: ListingCard; href: string }) {
  const urls = photoUrls(listing);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState<Record<string, true>>({});
  const place = [listing.property.ward, listing.property.city].filter(Boolean).join(", ");
  const current = urls[index] ?? null;
  const showControls = urls.length > 1;
  const preloaded = preloadIndexes(index, urls.length);

  function show(delta: number) {
    setIndex((current) => (current + delta + urls.length) % urls.length);
  }

  function markReady(url: string) {
    setReady((currentReady) => (currentReady[url] ? currentReady : { ...currentReady, [url]: true }));
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border-default bg-surface-card">
      <div className="relative aspect-4/3 bg-surface-brand-soft">
        <Link href={href} className="relative block h-full">
          {current && !ready[current] ? (
            <span className="absolute inset-0 z-[1] flex items-center justify-center bg-[#d9dde3] px-6 text-center text-sm text-[#3d4654]" aria-hidden="true">
              {listing.title}
            </span>
          ) : null}
          {preloaded.map((photoIndex) => {
            const url = urls[photoIndex];
            const selected = photoIndex === index;
            const visible = selected && ready[url];
            return (
              <Image
                key={`${photoIndex}-${url}`}
                src={url}
                alt={selected ? listing.title : ""}
                fill
                sizes={cardSizes}
                aria-hidden={selected ? undefined : true}
                className={`object-cover transition-opacity duration-200 ${visible ? "z-[2] opacity-100" : "opacity-0"}`}
                onLoad={() => markReady(url)}
              />
            );
          })}
        </Link>
        <span className="z-[3] pointer-events-none absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-heading">
          {listing.available_unit_count > 0 ? `${listing.available_unit_count} căn còn trống` : listing.availability_label}
        </span>
        {showControls ? (
          <>
            <button
              type="button"
              aria-label="Ảnh trước"
              className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-heading shadow-md"
              onClick={() => show(-1)}
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              aria-label="Ảnh sau"
              className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-heading shadow-md"
              onClick={() => show(1)}
            >
              <Chevron direction="right" />
            </button>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white">
              {index + 1}/{urls.length}
            </span>
          </>
        ) : null}
      </div>
      <Link href={href} className="grid gap-1 p-4">
        <p className="font-semibold text-heading">{formatRent(listing.rent_min, listing.rent_max)}</p>
        <p className="text-sm text-secondary">
          {kindLabels[listing.property.property_type] ?? listing.property.property_type}
          {" · "}Tối thiểu {listing.minimum_rental_months} tháng
        </p>
        <h3 className="text-base font-medium text-primary">{listing.title}</h3>
        <p className="text-sm text-secondary">{place}</p>
      </Link>
    </article>
  );
}

function preloadIndexes(index: number, length: number): number[] {
  if (length === 0) return [];
  const indexes = [index];
  if (length > 1) indexes.push((index + 1) % length);
  if (length > 2) indexes.push((index + 2) % length);
  return indexes;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
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
