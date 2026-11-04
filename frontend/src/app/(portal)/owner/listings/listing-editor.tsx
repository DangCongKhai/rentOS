"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ListingDetailView } from "@/components/listings/listing-detail";
import type {
  ListingDetail,
  PublicAmenity,
} from "@/features/discovery/listings-api";
import {
  ApiError,
  archiveOwnerListing,
  createOwnerListing,
  getAmenityCatalog,
  getOwnerListing,
  getOwnerListingById,
  getOwnerProperty,
  getOwnerPropertyMedia,
  hideOwnerListing,
  publishOwnerListing,
  submitOwnerListing,
  updateOwnerListing,
  updateOwnerUnit,
  type AmenityCatalogEntry,
  type OwnerListing,
  type OwnerPropertyDetail,
  type OwnerPropertyMedia,
  type OwnerUnit,
} from "@/lib/auth-api";

type FieldErrors = Record<string, string[]>;
type Action = "save" | "submit" | "publish" | "hide" | "archive" | null;

const inputClass =
  "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function statusLabel(listing: OwnerListing): string {
  if (listing.admin_suspended_at) return "Tạm ẩn bởi quản trị viên";
  if (listing.archived_at) return "Đã lưu trữ";
  if (listing.publication_status === "PUBLISHED") return "Đang hiển thị";
  if (listing.publication_status === "HIDDEN") return "Đã ẩn";
  if (listing.moderation_status === "PENDING") return "Đang chờ duyệt";
  if (listing.moderation_status === "APPROVED") return "Đã duyệt · Chưa đăng";
  if (listing.moderation_status === "REJECTED") return "Cần chỉnh sửa";
  return "Bản nháp";
}

function missingListingFields(unit: OwnerUnit): string[] {
  const missing: string[] = [];
  if (!unit.description?.trim()) missing.push("mô tả");
  if (unit.area_m2 === null) missing.push("diện tích");
  if (unit.advertised_monthly_rent === null) missing.push("giá thuê");
  if (unit.deposit === null) missing.push("tiền cọc");
  if (unit.max_occupants === null) missing.push("số người");
  return missing;
}

function unitReady(unit: OwnerUnit): boolean {
  return (
    unit.operational_status === "READY" && missingListingFields(unit).length === 0
  );
}

function amenityList(
  document: OwnerPropertyDetail["shared_amenities"],
  labels: Map<string, string>,
): PublicAmenity[] {
  return Object.entries(document.standard).flatMap(([key, value]) => {
    const label = labels.get(key);
    if (!value.enabled || !label) return [];
    return [{ key, label_vi: label, details: value.details ?? null }];
  });
}

function previewListing(
  property: OwnerPropertyDetail,
  media: OwnerPropertyMedia[],
  title: string,
  description: string,
  listingId: string,
  labels: Map<string, string>,
): ListingDetail {
  const units = property.units.filter(
    (unit) => !unit.archived_at && unit.is_marketed,
  );
  const photo = (item: OwnerPropertyMedia) => ({
    id: item.id,
    caption: item.caption,
    sort_order: item.sort_order,
    url: item.preview_url ?? "",
  });
  return {
    id: listingId,
    title: title || "Tiêu đề tin đăng",
    description,
    availability_label: "Bản xem trước",
    available_unit_count: units.length,
    gallery: media
      .filter(
        (item) =>
          item.unit_id === null &&
          item.is_selected_for_listing &&
          item.preview_url,
      )
      .map(photo),
    property: {
      name: property.name,
      property_type: property.property_type,
      rental_arrangement:
        property.rental_arrangement === "SEPARATE_UNITS"
          ? "SEPARATE_UNITS"
          : "WHOLE_SPACE",
      address_line: property.address_line ?? "",
      ward: property.ward,
      city: property.city ?? "",
      description: property.description ?? "",
      shared_rules: property.policies.shared_rules,
      shared_amenities: amenityList(property.shared_amenities, labels),
      custom_amenities: property.shared_amenities.custom,
      area: null,
    },
    owner: { name: "" },
    units: units.map((unit) => ({
      id: unit.id,
      label: unit.label,
      unit_kind: unit.unit_kind,
      description: unit.description,
      area_m2: String(unit.area_m2 ?? ""),
      bedrooms: unit.bedrooms,
      bathrooms: String(unit.bathrooms),
      advertised_monthly_rent: String(unit.advertised_monthly_rent ?? ""),
      deposit: String(unit.deposit ?? ""),
      minimum_rental_months: unit.minimum_rental_months,
      max_occupants: unit.max_occupants ?? 1,
      availability_label: "Bản xem trước",
      available_from: null,
      available_until: null,
      held_start: null,
      held_end: null,
      pets: unit.policy_overrides.pets ?? property.policies.pets,
      smoking: unit.policy_overrides.smoking ?? property.policies.smoking,
      rules: unit.policy_overrides.additional_rules ?? [],
      amenities: amenityList(unit.amenities, labels),
      custom_amenities: unit.amenities.custom,
      photos: media
        .filter(
          (item) =>
            item.preview_url &&
            item.is_selected_for_listing &&
            (item.unit_id === unit.id ||
              (item.unit_id === null &&
                (item.assigned_unit_ids ?? []).includes(unit.id))),
        )
        .map(photo),
    })),
  };
}

export function ListingEditor({
  listingId,
  propertyId,
}: {
  listingId?: string;
  propertyId?: string;
}) {
  const router = useRouter();
  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [listing, setListing] = useState<OwnerListing | null>(null);
  const [media, setMedia] = useState<OwnerPropertyMedia[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<"content" | "preview">(
    "content",
  );
  const [amenityLabels, setAmenityLabels] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const owned = listingId ? await getOwnerListingById(listingId) : null;
        const id = owned?.property_id ?? propertyId;
        if (!id) throw new ApiError(404, "Không tìm thấy tin đăng.");
        const [propertyResult, listingResult, mediaResult, catalog] =
          await Promise.all([
            getOwnerProperty(id),
            owned ? Promise.resolve(owned) : getOwnerListing(id),
            getOwnerPropertyMedia(id),
            getAmenityCatalog().catch(() => [] as AmenityCatalogEntry[]),
          ]);
        if (ignore) return;
        if (!listingId && listingResult) {
          router.replace(`/owner/listings/${listingResult.id}`);
          return;
        }
        let nextProperty = propertyResult;
        const activeUnits = nextProperty.units.filter((unit) => !unit.archived_at);
        if (activeUnits.length === 1) {
          const unit = activeUnits[0];
          const description = unit.description?.trim()
            ? unit.description
            : nextProperty.description?.trim() || null;
          const canMarket =
            unit.operational_status === "READY" &&
            Boolean(description) &&
            unit.area_m2 !== null &&
            unit.advertised_monthly_rent !== null &&
            unit.deposit !== null &&
            unit.max_occupants !== null;
          if (canMarket && (!unit.is_marketed || !unit.description?.trim())) {
            await updateOwnerUnit(nextProperty.id, unit.id, {
              expected_content_revision: nextProperty.content_revision,
              ...(unit.description?.trim() ? {} : { description }),
              is_marketed: true,
            });
            if (ignore) return;
            nextProperty = await getOwnerProperty(nextProperty.id);
          }
        }
        if (ignore) return;
        setProperty(nextProperty);
        setListing(listingResult);
        setMedia(mediaResult);
        setAmenityLabels(
          new Map(
            catalog.map((item) => [item.key, item.label_vi || item.label]),
          ),
        );
        setTitle(listingResult?.title ?? "");
        setDescription(listingResult?.description ?? "");
      } catch (caught) {
        if (ignore) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Không thể tải tin đăng.",
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [listingId, propertyId, router]);

  const sharedPhotos = useMemo(
    () =>
      media.filter(
        (item) => item.unit_id === null && item.is_selected_for_listing,
      ),
    [media],
  );
  const coverId = sharedPhotos[0]?.id ?? null;

  async function reload(id: string) {
    const [propertyResult, listingResult, mediaResult] = await Promise.all([
      getOwnerProperty(id),
      getOwnerListing(id),
      getOwnerPropertyMedia(id),
    ]);
    setProperty(propertyResult);
    setListing(listingResult);
    setMedia(mediaResult);
    return propertyResult;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    setSaving("save");
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      if (listing) {
        const updated = await updateOwnerListing(property.id, {
          expected_content_revision: property.content_revision,
          title,
          description,
          cover_media_id: coverId,
        });
        setListing(updated);
        setProperty((current) =>
          current
            ? {
                ...current,
                content_revision: updated.property_content_revision,
              }
            : current,
        );
        setSuccess("Đã lưu tin đăng.");
      } else {
        const created = await createOwnerListing(property.id, {
          client_operation_id: crypto.randomUUID(),
          title,
          description,
          cover_media_id: coverId,
        });
        router.replace(`/owner/listings/${created.id}`);
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors);
        if (caught.status === 409) await reload(property.id);
      } else {
        setError("Không thể lưu tin đăng. Vui lòng thử lại.");
      }
    } finally {
      setSaving(null);
    }
  }

  async function runAction(action: Exclude<Action, "save" | null>) {
    if (!property || !listing) return;
    if (
      action === "archive" &&
      !window.confirm(
        "Lưu trữ tin đăng này? Tin đăng sẽ không còn là tin hiện tại của bất động sản.",
      )
    )
      return;
    setSaving(action);
    setError(null);
    setSuccess(null);
    try {
      const revision = property.content_revision;
      const updated =
        action === "submit"
          ? await submitOwnerListing(property.id, revision)
          : action === "publish"
            ? await publishOwnerListing(property.id, revision)
            : action === "hide"
              ? await hideOwnerListing(property.id, revision)
              : await archiveOwnerListing(property.id, revision);
      if (action === "archive") {
        router.push("/owner/listings");
        return;
      }
      setListing(updated);
      setSuccess(
        action === "submit"
          ? "Đã gửi hồ sơ để quản trị viên duyệt."
          : action === "publish"
            ? "Tin đăng đã được hiển thị."
            : "Tin đăng đã được ẩn.",
      );
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors);
      } else {
        setError("Không thể cập nhật trạng thái tin đăng. Vui lòng thử lại.");
      }
    } finally {
      setSaving(null);
    }
  }

  async function toggleMarketed(unit: OwnerUnit) {
    if (!property) return;
    if (!unit.is_marketed && !unitReady(unit)) {
      setError(
        `Hoàn thiện mô tả, diện tích, giá thuê, tiền cọc và số người cho ${unit.label} trước khi đưa căn này lên tin.`,
      );
      return;
    }
    setSaving("save");
    setError(null);
    try {
      await updateOwnerUnit(property.id, unit.id, {
        expected_content_revision: property.content_revision,
        is_marketed: !unit.is_marketed,
      });
      await reload(property.id);
      setSuccess(
        unit.is_marketed
          ? `Đã bỏ ${unit.label} khỏi tin.`
          : `Đã chọn ${unit.label} để đăng.`,
      );
    } catch (caught) {
      if (caught instanceof ApiError) setError(caught.message);
      else setError("Không thể cập nhật căn được đăng.");
    } finally {
      setSaving(null);
    }
  }

  const units = property?.units.filter((unit) => !unit.archived_at) ?? [];
  const marketedUnits = units.filter((unit) => unit.is_marketed);
  const unitsReadyForListing =
    marketedUnits.length > 0 && marketedUnits.every(unitReady);
  const canEdit = !listing || listing.moderation_status !== "PENDING";

  if (loading)
    return (
      <div className="animate-pulse space-y-4" aria-busy="true">
        <div className="h-24 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-80 rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  if (!property)
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-700">
        {error ?? "Không tìm thấy tin đăng."}
      </div>
    );

  return (
    <div className="space-y-5">
      <Link
        href="/owner/listings"
        className="text-sm font-semibold text-[#3368a0] hover:underline"
      >
        ← Danh sách tin đăng
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold text-slate-900">{property.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>{units.length} phòng</span>
          <span>Phiên bản nội dung {property.content_revision}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
            {listing ? statusLabel(listing) : "Chưa có tin đăng"}
          </span>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}
      {listing?.review_reason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Phản hồi quản trị viên:</strong> {listing.review_reason}
        </div>
      )}
      <nav
        aria-label="Chế độ chỉnh sửa tin đăng"
        className="flex gap-5 border-b border-slate-200"
      >
        <button
          type="button"
          onClick={() => setEditorView("content")}
          className={`border-b-2 px-3 py-3 text-sm font-semibold ${editorView === "content" ? "border-[#3368a0] text-[#285584]" : "border-transparent text-slate-600"}`}
        >
          Nội dung
        </button>
        <button
          type="button"
          onClick={() => setEditorView("preview")}
          className={`border-b-2 px-3 py-3 text-sm font-semibold ${editorView === "preview" ? "border-[#3368a0] text-[#285584]" : "border-transparent text-slate-600"}`}
        >
          Xem trước
        </button>
      </nav>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {editorView === "content" ? (
          <form id="listing-form" onSubmit={handleSave} className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                {listing ? "Nội dung tin đăng" : "Tạo bản nháp"}
              </h2>
              {!canEdit && (
                <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  Đang chờ duyệt. Nếu cần sửa, hãy lưu thay đổi để mở lại hồ sơ
                  thành bản nháp.
                </p>
              )}
              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="listing-title"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Tiêu đề
                  </label>
                  <input
                    id="listing-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    minLength={5}
                    maxLength={160}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="listing-description"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Mô tả tin đăng
                  </label>
                  <textarea
                    id="listing-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                    minLength={20}
                    maxLength={10000}
                    rows={6}
                    className={inputClass}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {coverId
                    ? "Ảnh đầu tiên trong thư viện dùng chung sẽ mở đầu thư viện ảnh."
                    : "Chưa có ảnh dùng chung được chọn. Thêm ảnh trong trang bất động sản."}
                </p>
              </div>
              {Object.keys(fieldErrors).length > 0 && (
                <ul className="mt-4 list-disc pl-5 text-sm text-rose-800">
                  {Object.entries(fieldErrors).map(([field, messages]) => (
                    <li key={field}>{messages[0]}</li>
                  ))}
                </ul>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={saving !== null}
                  className="inline-flex min-h-11 items-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving === "save"
                    ? "Đang lưu…"
                    : listing
                      ? "Lưu nội dung"
                      : "Lưu bản nháp"}
                </button>
                {listing && (
                  <button
                    type="button"
                    onClick={() => void runAction("archive")}
                    className="text-sm font-semibold text-rose-700"
                  >
                    Lưu trữ
                  </button>
                )}
              </div>
            </section>
            {units.length === 1 ? (
              !unitReady(units[0]) && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  Còn thiếu {missingListingFields(units[0]).join(", ")}. Bổ sung
                  trong trang bất động sản trước khi gửi duyệt.
                </p>
              )
            ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Căn đưa lên tin
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Bật những căn sẽ xuất hiện trong tin đăng này.
              </p>
              <ul className="mt-4 divide-y divide-slate-100">
                {units.map((unit) => (
                  <li
                    key={unit.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {unit.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {unitReady(unit)
                          ? "Đủ thông tin để đăng"
                          : `Còn thiếu ${missingListingFields(unit).join(", ")}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={unit.is_marketed}
                      disabled={saving !== null}
                      onClick={() => void toggleMarketed(unit)}
                      className={`h-6 w-11 rounded-full p-1 ${unit.is_marketed ? "bg-[#3368a0]" : "bg-slate-300"}`}
                    >
                      <span
                        className={`block size-4 rounded-full bg-white transition ${unit.is_marketed ? "translate-x-5" : ""}`}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            )}
          </form>
        ) : (
          <div className="min-w-0 overflow-hidden rounded-2xl bg-[#f4f6f8] p-4 sm:p-6">
            <ListingDetailView
              listing={previewListing(
                property,
                media,
                title,
                description,
                listing?.id ?? "draft",
                amenityLabels,
              )}
              isSignedIn={false}
              preview
            />
          </div>
        )}
        <div className="space-y-4">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 sm:p-5">
            <h3 className="font-semibold text-slate-900">
              Điều kiện gửi duyệt
            </h3>
            <ul className="mt-3 space-y-3">
              <li className="flex gap-2">
                <span
                  className={
                    property.address_line && property.city
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }
                >
                  {property.address_line && property.city ? "✓" : "×"}
                </span>
                Địa chỉ đầy đủ
              </li>
              <li className="flex gap-2">
                <span
                  className={
                    sharedPhotos.length ? "text-emerald-700" : "text-rose-700"
                  }
                >
                  {sharedPhotos.length ? "✓" : "×"}
                </span>
                Có ảnh dùng chung được chọn
              </li>
              <li className="flex gap-2">
                <span
                  className={
                    unitsReadyForListing ? "text-emerald-700" : "text-rose-700"
                  }
                >
                  {unitsReadyForListing ? "✓" : "×"}
                </span>
                Căn được chọn đã đủ điều kiện đăng
              </li>
            </ul>
            <Link
              href={`/owner/properties/${property.id}`}
              className="mt-4 inline-flex font-semibold text-[#3368a0] hover:underline"
            >
              Quản lý bất động sản, căn và ảnh →
            </Link>
          </aside>
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="font-semibold text-slate-900">
              Gửi duyệt và đăng bài
            </h3>
            <div className="mt-4 grid gap-2">
              {listing &&
                ["DRAFT", "REJECTED"].includes(listing.moderation_status) && (
                  <button
                    type="button"
                    onClick={() => void runAction("submit")}
                    disabled={saving !== null}
                    className="min-h-11 rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Gửi duyệt
                  </button>
                )}
              {listing?.moderation_status === "APPROVED" &&
                listing.publication_status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => void runAction("publish")}
                    disabled={
                      saving !== null || Boolean(listing.admin_suspended_at)
                    }
                    className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Đăng công khai
                  </button>
                )}
              {listing?.publication_status === "PUBLISHED" && (
                <button
                  type="button"
                  onClick={() => void runAction("hide")}
                  disabled={saving !== null}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
                >
                  Ẩn tin đăng
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
