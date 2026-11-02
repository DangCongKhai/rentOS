"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Slide } from "./listing-format";

function sideCellSpan(count: number, index: number): string {
  if (count === 2) return "col-span-2";
  if (count === 3 && index === 2) return "col-span-2";
  return "";
}

export function ListingPhotoGrid({ slides }: { slides: Slide[] }) {
  const [open, setOpen] = useState(false);
  if (slides.length === 0) return null;

  const hero = slides[0];
  const side = slides.slice(1, 5);

  return (
    <>
      <div
        className={`relative grid h-[240px] grid-rows-[minmax(0,1fr)] gap-2 overflow-hidden rounded-2xl sm:h-[320px] lg:h-[460px] ${side.length > 0 ? "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : "grid-cols-1"}`}
      >
        <button
          type="button"
          className="relative min-h-0 overflow-hidden"
          onClick={() => setOpen(true)}
          aria-label={hero.label}
        >
          <Image
            src={hero.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 700px, 100vw"
            className="object-cover"
          />
        </button>
        {side.length > 0 ? (
          <div
            className={`grid h-full min-h-0 gap-2 ${side.length === 1 ? "grid-cols-1 grid-rows-1" : "grid-cols-2 grid-rows-2"}`}
          >
            {side.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className={`relative min-h-0 overflow-hidden ${sideCellSpan(side.length, index)}`}
                aria-label={slide.label}
                onClick={() => setOpen(true)}
              >
                <Image
                  src={slide.url}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 280px, 45vw"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
        {slides.length > 1 ? (
          <button
            type="button"
            className="absolute bottom-4 right-4 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#091216] shadow-md"
            onClick={() => setOpen(true)}
          >
            Xem tất cả {slides.length} ảnh
          </button>
        ) : null}
      </div>
      {open ? (
        <PhotoDialog slides={slides} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function PhotoDialog({
  slides,
  onClose,
}: {
  slides: Slide[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tất cả ảnh"
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white px-4"
        onClick={(event) => event.stopPropagation()}
      >
        {/* FIXED: Đồng bộ -mx-4 sm:-mx-8 và px-4 sm:px-8 để che khít phần viền khi cuộn ở mọi kích cỡ màn hình */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white -mx-4 px-4 pb-4 pt-1 sm:-mx-8 sm:px-8">
          <h2 className="text-lg font-bold text-[#091216]">Tất cả ảnh</h2>
          <button
            type="button"
            className="min-h-10 rounded-lg border border-[#d5dee7] px-3 text-sm font-semibold"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
        <div className="grid gap-4">
          {slides.map((slide) => (
            <figure key={slide.key} className="grid gap-2">
              <Image
                src={slide.url}
                alt={slide.label}
                width={1200}
                height={800}
                sizes="(min-width: 768px) 768px, 100vw"
                className="h-auto w-full rounded-xl object-cover"
              />
              <figcaption className="text-sm text-[#454e5c]">
                {slide.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
