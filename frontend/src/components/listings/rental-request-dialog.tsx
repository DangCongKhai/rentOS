"use client";

import { useEffect } from "react";
import type { ListingDetail } from "@/features/discovery/listings-api";
import { RentalRequestForm } from "./rental-request-form";

export function RentalRequestDialog({
  listing,
  isSignedIn,
  preferredUnitId,
  onPreferredUnitChange,
  onClose,
}: {
  listing: ListingDetail;
  isSignedIn: boolean;
  preferredUnitId: string;
  onPreferredUnitChange: (unitId: string) => void;
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
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gửi yêu cầu thuê"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-[#091216]">Gửi yêu cầu thuê</h2>
          <button type="button" className="min-h-10 rounded-lg border border-[#d5dee7] px-3 text-sm font-semibold" onClick={onClose}>
            Đóng
          </button>
        </div>
        <RentalRequestForm
          listing={listing}
          isSignedIn={isSignedIn}
          preferredUnitId={preferredUnitId}
          onPreferredUnitChange={onPreferredUnitChange}
        />
      </div>
    </div>
  );
}
