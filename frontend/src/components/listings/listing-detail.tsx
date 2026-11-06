"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ListingDetail, PublicAmenity } from "@/features/discovery/listings-api";
import { AvailableUnits } from "./available-units";
import { amenityIcon, ListingIcon } from "./listing-icon";
import {
  areaLabel,
  bathLabel,
  depositCopy,
  dong,
  extraAmenities,
  minimumMonths,
  petCopy,
  photoSlides,
  placeLine,
  propertyBadge,
  rentBounds,
  ruleTitle,
  uniqueUnitAmenities,
  unitKindLabel,
} from "./listing-format";
import { ListingPhotoGrid } from "./listing-photo-grid";
import { ListingReportDialog } from "./listing-report-dialog";
import { ListingRequestAside } from "./listing-request-aside";
import { RentalRequestDialog } from "./rental-request-dialog";

const ListingAreaMap = dynamic(
  () => import("./listing-area-map").then((mod) => mod.ListingAreaMap),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-[#e8ebf0]" /> },
);

export function ListingDetailView({
  listing,
  isSignedIn,
  preview = false,
}: {
  listing: ListingDetail;
  isSignedIn: boolean;
  preview?: boolean;
}) {
  const searchParams = useSearchParams();
  const [requestOpen, setRequestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [preferredUnitId, setPreferredUnitId] = useState(listing.units[0]?.id ?? "");
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const rents = rentBounds(listing.units);
  const months = minimumMonths(listing.units);
  const openCount = listing.available_unit_count;
  const query = searchParams.toString();
  const listingsHref = query ? `/listings?${query}` : "/listings";
  const extras = extraAmenities(listing);
  const wholeSpace = listing.property.rental_arrangement === "WHOLE_SPACE";
  const wholeUnit = wholeSpace ? listing.units[0] : undefined;
  const sharedAmenityKeys = new Set(listing.property.shared_amenities.map((amenity) => amenity.key));
  const unitAmenities = uniqueUnitAmenities(listing.units).filter((amenity) =>
    wholeSpace ? !sharedAmenityKeys.has(amenity.key) : true,
  );

  function chooseUnit(unitId: string) {
    setPreferredUnitId(unitId);
    setOpenUnitId(unitId);
  }

  return (
    <div className={preview ? "min-w-0" : "flex-1 bg-[#f4f6f8] px-4 py-6 sm:px-8"}>
      <div className={preview ? "grid min-w-0 gap-8" : "mx-auto grid w-full max-w-[1200px] gap-8"}>
        {preview ? null : <Link href={listingsHref} className="w-fit text-sm font-semibold text-[#3368a0]">
          ← Quay lại kết quả tìm kiếm
        </Link>}
        <ListingPhotoGrid slides={photoSlides(listing)} />
        <div className={preview ? "grid min-w-0 items-start gap-8" : "grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]"}>
          <article className="order-2 grid min-w-0 gap-10 lg:order-none">
            <header className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#e8ebf0] px-3 py-1 text-[13px] font-semibold text-[#454e5c]">{propertyBadge(listing)}</span>
                <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${openCount > 0 ? "bg-[#ddf3e4] text-[#14692f]" : "bg-[#e8ebf0] text-[#454e5c]"}`}>
                  {openCount > 0 ? `${openCount} căn còn trống` : listing.availability_label}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#091216] sm:text-4xl">{listing.title}</h1>
              <p className="flex items-center gap-2 text-sm text-[#454e5c]">
                <ListingIcon name="pin" size={18} />
                {placeLine(listing)}
              </p>
              {rents ? (
                <p>
                  <span className="text-3xl font-bold text-[#091216]">từ {dong(rents.min)}</span>
                  <span className="text-lg text-[#454e5c]"> /tháng</span>
                </p>
              ) : null}
              {listing.units.length > 0 ? (
                <div className="flex flex-wrap gap-8 border-y border-[#e1e7ed] py-4">
                  <Fact value={unitKindLabel(listing.units)} caption="Loại căn" />
                  <Fact value={bathLabel(listing.units)} caption="Phòng tắm" />
                  <Fact value={areaLabel(listing.units)} caption="Diện tích" />
                </div>
              ) : null}
            </header>

            {wholeSpace && wholeUnit ? (
              <section className="grid gap-4" aria-label="Thông tin cho thuê">
                <h2 className="text-2xl font-bold text-[#091216]">Thông tin cho thuê</h2>
                <div className="grid gap-3 rounded-2xl border border-[#d5dee7] bg-white p-6 sm:grid-cols-2">
                  <Fact value={wholeUnit.bedrooms > 0 ? `${wholeUnit.bedrooms} phòng ngủ` : "Không tách phòng ngủ"} caption="Phòng ngủ" />
                  <Fact value={bathLabel([wholeUnit])} caption="Phòng tắm" />
                  <Fact value={areaLabel([wholeUnit])} caption="Diện tích" />
                  <Fact value={dong(Number(wholeUnit.advertised_monthly_rent))} caption="Giá thuê mỗi tháng" />
                  <Fact value={dong(Number(wholeUnit.deposit))} caption="Tiền đặt cọc" />
                  <Fact value={`${wholeUnit.max_occupants} người`} caption="Số người tối đa" />
                </div>
              </section>
            ) : (
              <AvailableUnits
                units={listing.units}
                selectedUnitId={preferredUnitId}
                openUnitId={openUnitId}
                onChoose={chooseUnit}
                onClose={() => setOpenUnitId(null)}
              />
            )}

            <section className="grid gap-4" aria-label="Tiện ích nổi bật">
              <h2 className="text-2xl font-bold text-[#091216]">Tiện ích nổi bật</h2>
              <section aria-label="Tiện ích chung">
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                  {listing.property.shared_amenities.map((amenity) => (
                    <AmenityCard key={amenity.key} amenity={amenity} scope="Tòa nhà" />
                  ))}
                </ul>
              </section>
              {unitAmenities.length > 0 ? (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                  {unitAmenities.map((amenity) => (
                    <AmenityCard key={amenity.key} amenity={amenity} scope="Trong căn" />
                  ))}
                </ul>
              ) : null}
              {extras.length > 0 ? (
                <p className="text-sm text-[#454e5c]">
                  <span className="font-bold">Tiện ích bổ sung</span>
                  {` (không dùng để lọc tìm kiếm): ${extras.join(" · ")}`}
                </p>
              ) : null}
            </section>

            {listing.property.area ? <section className="grid gap-3" aria-label="Vị trí gần đúng">
              <h2 className="text-2xl font-bold text-[#091216]">Vị trí gần đúng</h2>
              <p className="text-sm text-[#454e5c]">Ghim nằm trong khu vực lân cận, không phải địa chỉ cửa nhà. Địa chỉ chính xác được trao đổi sau khi bạn gửi yêu cầu thuê.</p>
              <ListingAreaMap latitude={listing.property.area.latitude} longitude={listing.property.area.longitude} />
            </section> : null}

            <section aria-label="Nội quy đang quảng cáo" className="grid gap-4 rounded-2xl border border-[#d5dee7] bg-white p-6">
              <div>
                <h2 className="text-2xl font-bold text-[#091216]">Điều khoản và nội quy đã quảng cáo</h2>
                <p className="pt-1 text-sm text-[#454e5c]">Điều khoản cuối cùng được ghi trong phiên bản hợp đồng mà chủ nhà gửi để bạn xác nhận.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Policy title="Tiền đặt cọc" body={depositCopy(listing.units)} />
                <Policy title="Thời hạn thuê tối thiểu" body={months > 0 ? `${months} tháng` : "Theo từng căn"} />
                <Policy title="Thú cưng" body={petCopy(listing.units)} />
                {listing.property.shared_rules.map((rule) => (
                  <Policy key={rule} title={ruleTitle(rule)} body={rule} />
                ))}
                <Policy title="Hợp đồng thuê" body="Chủ nhà gửi phiên bản hợp đồng, bạn xem và xác nhận trước hạn chót." />
              </div>
              <p className="flex items-start gap-2 rounded-xl bg-[#eef3f9] px-4 py-3 text-sm text-[#1f3a5c]">
                <ListingIcon name="info" size={18} />
                Giá và quy định quảng cáo có thể khác với hợp đồng cuối cùng. Xác nhận hợp đồng là ghi nhận phiên bản đã lưu trữ, không phải chữ ký điện tử.
              </p>
            </section>

            <section className="grid gap-3">
              <h2 className="text-2xl font-bold text-[#091216]">Giới thiệu</h2>
              {listing.description ? <p className="text-base leading-7 text-[#2b3544]">{listing.description}</p> : null}
              {listing.property.description && listing.property.description !== listing.description ? (
                <p className="text-base leading-7 text-[#2b3544]">{listing.property.description}</p>
              ) : null}
              {preview ? null : isSignedIn ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm leading-5 text-[#5b6676]"
                  onClick={() => setReportOpen(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/listings/report-flag.svg" alt="" width={14} height={14} />
                  Báo cáo
                </button>
              ) : (
                <Link href="/login" className="inline-flex items-center gap-1.5 text-sm leading-5 text-[#5b6676]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/listings/report-flag.svg" alt="" width={14} height={14} />
                  Đăng nhập để báo cáo tin đăng này
                </Link>
              )}
            </section>
          </article>

          {preview ? null : <div className="order-1 lg:order-none lg:sticky lg:top-[91px] lg:self-start">
            <ListingRequestAside ownerName={listing.owner?.name ?? ""} onRequest={() => setRequestOpen(true)} />
          </div>}
        </div>
      </div>
      {reportOpen ? <ListingReportDialog listingTitle={listing.title} onClose={() => setReportOpen(false)} /> : null}
      {requestOpen ? (
        <RentalRequestDialog
          listing={listing}
          isSignedIn={isSignedIn}
          onClose={() => setRequestOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Fact({ value, caption }: { value: string; caption: string }) {
  return (
    <p>
      <span className="block text-lg font-bold text-[#091216]">{value}</span>
      <span className="block text-sm text-[#5b6676]">{caption}</span>
    </p>
  );
}

function AmenityCard({ amenity, scope }: { amenity: PublicAmenity; scope: string }) {
  return (
    <li className="grid min-w-0 gap-1 overflow-hidden rounded-xl bg-[#eaf1f7] p-4">
      <ListingIcon name={amenityIcon(amenity.key)} size={22} />
      <p className="break-words font-bold text-[#091216]">{amenity.label_vi}</p>
      <p className="text-[13px] text-[#5b6676]">{amenity.details ? `${scope} · ${amenity.details}` : scope}</p>
    </li>
  );
}

function Policy({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#d5dee7] px-4 py-3">
      <p className="font-semibold text-[#091216]">{title}</p>
      <p className="text-sm text-[#454e5c]">{body}</p>
    </div>
  );
}
