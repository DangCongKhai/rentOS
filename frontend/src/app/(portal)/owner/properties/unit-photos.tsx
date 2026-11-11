"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import {
  ApiError,
  getOwnerProperty,
  getOwnerPropertyMedia,
  removeOwnerMedia,
  saveOwnerUnitSharedMedia,
  uploadOwnerMedia,
  type OwnerPropertyDetail,
  type OwnerPropertyMedia,
} from "@/lib/auth-api";

const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";

export function UnitPhotoManager({
  propertyId,
  unitId,
}: {
  propertyId: string;
  unitId: string;
}) {
  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [media, setMedia] = useState<OwnerPropertyMedia[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingUrls = useMemo(
    () => pending.map((file) => URL.createObjectURL(file)),
    [pending],
  );

  const load = useCallback(async () => {
    const [detail, photos] = await Promise.all([
      getOwnerProperty(propertyId),
      getOwnerPropertyMedia(propertyId),
    ]);
    setProperty(detail);
    setMedia(photos);
    setSelectedIds(
      photos
        .filter(
          (item) =>
            item.unit_id === null &&
            (item.assigned_unit_ids ?? []).includes(unitId),
        )
        .map((item) => item.id),
    );
  }, [propertyId, unitId]);

  useEffect(() => {
    let active = true;
    async function loadPhotos() {
      try {
        const [detail, photos] = await Promise.all([
          getOwnerProperty(propertyId),
          getOwnerPropertyMedia(propertyId),
        ]);
        if (!active) return;
        setProperty(detail);
        setMedia(photos);
        setSelectedIds(
          photos
            .filter(
              (item) =>
                item.unit_id === null &&
                (item.assigned_unit_ids ?? []).includes(unitId),
            )
            .map((item) => item.id),
        );
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof ApiError ? caught.message : "Không thể tải ảnh.",
        );
      }
    }
    void loadPhotos();
    return () => {
      active = false;
    };
  }, [propertyId, unitId]);

  useEffect(() => {
    return () => {
      pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingUrls]);

  const shared = media
    .filter((item) => item.unit_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  const own = media
    .filter((item) => item.unit_id === unitId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const savedIds = shared
    .filter((item) => (item.assigned_unit_ids ?? []).includes(unitId))
    .map((item) => item.id);
  const selectionChanged =
    selectedIds.length !== savedIds.length ||
    selectedIds.some((id) => !savedIds.includes(id));

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property || pending.length === 0) return;
    if (
      pending.some(
        (file) =>
          !/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) ||
          file.size > 8 * 1024 * 1024,
      ) ||
      media.length + pending.length > 20
    ) {
      toast.error(
        "Chọn ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 8 MB; tổng tối đa 20 ảnh.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let revision = property.content_revision;
      for (const file of pending) {
        const uploaded = await uploadOwnerMedia(property.id, {
          file,
          client_operation_id: crypto.randomUUID(),
          expected_content_revision: revision,
          unit_id: unitId,
        });
        revision = uploaded.content_revision;
      }
      setPending([]);
      await load();
      toast.success("Ảnh đã được tải lên.");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Không thể tải ảnh lên.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveShared() {
    if (!property) return;
    setBusy(true);
    setError(null);
    try {
      await saveOwnerUnitSharedMedia(property.id, unitId, {
        expected_content_revision: property.content_revision,
        media_ids: selectedIds,
      });
      await load();
      toast.success("Đã lưu ảnh dùng chung cho căn này.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không thể lưu lựa chọn ảnh.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: OwnerPropertyMedia) {
    if (
      !property ||
      !window.confirm("Gỡ ảnh khỏi thư viện? Tệp được lưu giữ trong lịch sử.")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await removeOwnerMedia(
        property.id,
        photo.id,
        property.content_revision,
        photo.revision,
      );
      await load();
      toast.success("Ảnh đã được gỡ khỏi thư viện.");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Không thể gỡ ảnh.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Ảnh riêng của căn
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Những ảnh này chỉ thuộc căn đang sửa.
        </p>
        <form onSubmit={upload} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              JPG, PNG, WEBP · tối đa 8 MB mỗi ảnh · tối đa 20 ảnh
            </p>
            <div className="flex flex-wrap gap-2">
              <label className={`${buttonClass} cursor-pointer`}>
                Chọn ảnh
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    setPending(Array.from(event.currentTarget.files ?? []));
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {pending.length > 0 && (
                <button type="submit" disabled={busy} className={buttonClass}>
                  {busy ? "Đang tải…" : `Tải ${pending.length} ảnh`}
                </button>
              )}
            </div>
          </div>
          {pending.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {pendingUrls[index] && (
                      <Image
                        src={pendingUrls[index]}
                        alt={file.name}
                        fill
                        unoptimized
                        sizes="30vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </form>
        {own.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Chưa có ảnh riêng.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {own.map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  {photo.preview_url ? (
                    <Image
                      src={photo.preview_url}
                      alt={photo.caption || "Ảnh căn"}
                      fill
                      unoptimized
                      sizes="30vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Ảnh
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="truncate">{photo.caption || "Ảnh căn"}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(photo)}
                    className="font-semibold text-rose-700"
                  >
                    Gỡ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Ảnh dùng chung từ bất động sản
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Chọn ảnh của bất động sản sẽ xuất hiện cùng căn này. Ảnh không bị
              sao chép.
            </p>
          </div>
          {shared.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === shared.length
                      ? []
                      : shared.map((item) => item.id),
                  )
                }
                className={secondaryButtonClass}
              >
                {selectedIds.length === shared.length
                  ? "Bỏ chọn tất cả"
                  : "Chọn tất cả"}
              </button>
              <button
                type="button"
                disabled={busy || !selectionChanged}
                onClick={() => void saveShared()}
                className={buttonClass}
              >
                Lưu lựa chọn
              </button>
            </div>
          )}
        </div>
        {shared.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Chưa có ảnh dùng chung. Hãy tải ảnh ở mục Hình ảnh của bất động sản.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {shared.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <li
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {item.preview_url ? (
                      <Image
                        src={item.preview_url}
                        alt={item.caption || "Ảnh dùng chung"}
                        fill
                        unoptimized
                        sizes="25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Ảnh
                      </div>
                    )}
                    <label className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-md bg-white/95">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setSelectedIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }
                        className="size-4 accent-[#3368a0]"
                        aria-label="Chọn ảnh dùng chung"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="truncate">
                      {item.caption || "Ảnh dùng chung"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${selected ? "bg-blue-50 text-[#285584]" : "bg-slate-100 text-slate-500"}`}
                    >
                      {selected ? "Đã chọn" : "Chưa chọn"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
