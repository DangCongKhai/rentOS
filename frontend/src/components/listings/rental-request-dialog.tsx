"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import type { ListingDetail } from "@/features/discovery/listings-api";
import { RentalRequestForm } from "./rental-request-form";

export function RentalRequestDialog({
  listing,
  isSignedIn,
  onClose,
}: {
  listing: ListingDetail;
  isSignedIn: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      const pickerOpen = dialogRef.current?.querySelector('[aria-haspopup][aria-expanded="true"]');
      if (event.key === "Escape" && !event.defaultPrevented && !pickerOpen) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-surface-nav-dark/60 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[calc(100dvh-32px)] w-full max-w-[1040px] flex-col overflow-hidden rounded-[20px] bg-surface-card shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-4 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-6">
          <div className="grid gap-2">
            <h2 id={titleId} className="text-2xl font-semibold tracking-tight text-heading sm:text-3xl">Gửi yêu cầu thuê</h2>
            <p id={descriptionId} className="text-sm text-secondary sm:text-base">
              Để lại thông tin để chủ nhà liên hệ. Việc xem nhà và thanh toán diễn ra ngoài ứng dụng.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Đóng hộp thoại"
            className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-surface-app"
            onClick={onClose}
          >
            <Image src="/images/rental-request/close.svg" alt="" width={22} height={22} />
          </button>
        </header>
        <RentalRequestForm listing={listing} isSignedIn={isSignedIn} onCancel={onClose} />
      </div>
    </div>
  );
}
