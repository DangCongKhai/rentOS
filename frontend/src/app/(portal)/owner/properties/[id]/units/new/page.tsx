"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createOwnerUnitBatch,
  getOwnerProperty,
  type OwnerPropertyDetail,
  ApiError,
} from "@/lib/auth-api";

const fieldClass =
  "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-4 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";

type RoomDraft = {
  label: string;
  customized: boolean;
  unit_kind: string;
  area_m2: string;
  floor: string;
  rent: string;
  deposit: string;
  minimum_rental_months: string;
  max_occupants: string;
  bedrooms: string;
  bathrooms: string;
  bathroom_arrangement: "PRIVATE" | "SHARED";
  description: string;
};

function emptyRoom(label: string): RoomDraft {
  return {
    label,
    customized: false,
    unit_kind: "ROOM",
    area_m2: "",
    floor: "",
    rent: "",
    deposit: "",
    minimum_rental_months: "3",
    max_occupants: "1",
    bedrooms: "0",
    bathrooms: "1",
    bathroom_arrangement: "PRIVATE",
    description: "",
  };
}

// Generate a v4 UUID
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Validate rooms before submission
function validateRooms(rooms: RoomDraft[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seenLabels = new Set<string>();

  rooms.forEach((room, index) => {
    const roomLabel = `Phòng ${index + 1}`;

    // Check required fields
    if (!room.label.trim()) {
      errors.push(`${roomLabel}: Tên phòng không được để trống`);
    }

    // Check for duplicate labels within the batch
    const normalizedLabel = room.label.trim().toLowerCase();
    if (normalizedLabel && seenLabels.has(normalizedLabel)) {
      errors.push(
        `${roomLabel}: Tên "${room.label}" bị trùng với phòng khác trong danh sách`,
      );
    }
    seenLabels.add(normalizedLabel);

    // Validate numeric fields
    if (room.bedrooms.trim() && Number(room.bedrooms) < 0) {
      errors.push(`${roomLabel}: Số phòng ngủ phải >= 0`);
    }

    if (room.bathrooms.trim() && Number(room.bathrooms) < 0) {
      errors.push(`${roomLabel}: Số phòng tắm phải >= 0`);
    }

    if (room.max_occupants.trim() && Number(room.max_occupants) < 1) {
      errors.push(`${roomLabel}: Số người tối đa phải >= 1`);
    }

    if (
      room.minimum_rental_months.trim() &&
      Number(room.minimum_rental_months) < 3
    ) {
      errors.push(`${roomLabel}: Thời gian thuê tối thiểu phải >= 3 tháng`);
    }

    if (room.area_m2.trim() && Number(room.area_m2) <= 0) {
      errors.push(`${roomLabel}: Diện tích phải > 0`);
    }

    if (room.rent.trim() && Number(room.rent) <= 0) {
      errors.push(`${roomLabel}: Giá thuê phải > 0`);
    }

    if (room.deposit.trim() && Number(room.deposit) < 0) {
      errors.push(`${roomLabel}: Tiền cọc phải >= 0`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Parse backend validation errors
function parseValidationErrors(apiError: ApiError): string[] {
  const messages: string[] = [];

  for (const [field, fieldErrors] of Object.entries(apiError.errors)) {
    // Extract room index from field path like "units.0.label"
    const match = field.match(/^units\.(\d+)\.(.+)$/);
    if (match) {
      const roomIndex = parseInt(match[1], 10);
      const fieldName = match[2];
      const roomLabel = `Phòng ${roomIndex + 1}`;

      // Map field names to Vietnamese
      const fieldNames: Record<string, string> = {
        label: "Tên phòng",
        unit_kind: "Loại phòng",
        area_m2: "Diện tích",
        floor: "Tầng",
        bedrooms: "Phòng ngủ",
        bathrooms: "Phòng tắm",
        bathroom_arrangement: "Loại phòng tắm",
        max_occupants: "Số người tối đa",
        advertised_monthly_rent: "Giá thuê",
        deposit: "Tiền cọc",
        minimum_rental_months: "Thời gian thuê tối thiểu",
        description: "Mô tả",
        client_operation_id: "ID",
      };

      const vietnameseField = fieldNames[fieldName] || fieldName;
      fieldErrors.forEach((error) => {
        messages.push(`${roomLabel} - ${vietnameseField}: ${error}`);
      });
    } else {
      // Top-level errors
      fieldErrors.forEach((error) => {
        messages.push(error);
      });
    }
  }

  return messages;
}

function AddUnitsPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const propertyId = params.id;

  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [unitCount, setUnitCount] = useState(1);
  const [unitPrefix, setUnitPrefix] = useState("Phòng");
  const [startNumber, setStartNumber] = useState(101);
  const [rooms, setRooms] = useState<RoomDraft[]>([emptyRoom("Phòng 101")]);
  const [activeRoom, setActiveRoom] = useState(0);

  useEffect(() => {
    async function loadProperty() {
      try {
        const detail = await getOwnerProperty(propertyId);
        setProperty(detail);
      } catch {
        toast.error("Không thể tải thông tin bất động sản.");
        router.push("/owner/properties");
      } finally {
        setLoading(false);
      }
    }

    void loadProperty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);
  function updateRoomPlan(count: number, prefix: string, start: number) {
    setUnitCount(count);
    setUnitPrefix(prefix);
    setStartNumber(start);
    const next = Array.from({ length: count }, (_, index) =>
      emptyRoom(`${prefix} ${start + index}`),
    );
    setRooms(next);
    setActiveRoom(0);
  }

  function updateRoom(index: number, patch: Partial<RoomDraft>, copy = true) {
    setRooms((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch, customized: true };
      if (copy) {
        for (let i = 0; i < next.length; i++) {
          if (i !== index && !next[i].customized) {
            next[i] = { ...next[i], ...patch };
          }
        }
      }
      return next;
    });
  }

  function applyRoomToEmpty(index: number) {
    const source = rooms[index];
    if (!source) return;
    setRooms((current) =>
      current.map((room, roomIndex) => {
        if (roomIndex === index || room.customized) return room;
        return { ...source, label: room.label, customized: false };
      }),
    );
  }

  async function saveNewRooms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;

    // Client-side validation first
    const validation = validateRooms(rooms);
    if (!validation.valid) {
      validation.errors.forEach((error) => {
        toast.error(error, { duration: 5000 });
      });
      return;
    }

    setBusy(true);
    try {
      await createOwnerUnitBatch(property.id, {
        expected_content_revision: property.content_revision,
        client_operation_id: generateUUID(),
        units: rooms.map((room) => ({
          client_operation_id: generateUUID(),
          label: room.label,
          unit_kind: room.unit_kind,
          area_m2: room.area_m2.trim() === "" ? null : Number(room.area_m2),
          floor: room.floor || null,
          advertised_monthly_rent:
            room.rent.trim() === "" ? null : Number(room.rent),
          deposit: room.deposit.trim() === "" ? null : Number(room.deposit),
          minimum_rental_months:
            room.minimum_rental_months.trim() === ""
              ? null
              : Number(room.minimum_rental_months),
          max_occupants:
            room.max_occupants.trim() === ""
              ? null
              : Number(room.max_occupants),
          bedrooms: room.bedrooms.trim() === "" ? null : Number(room.bedrooms),
          bathrooms:
            room.bathrooms.trim() === "" ? null : Number(room.bathrooms),
          bathroom_arrangement: room.bathroom_arrangement,
          description: room.description || null,
          operational_status: "READY",
        })),
      });
      toast.success(`Đã thêm ${rooms.length} phòng mới.`);
      router.push(`/owner/properties/${propertyId}?tab=units`);
    } catch (error) {
      console.error("Error creating units:", error);

      // Parse and display backend validation errors
      if (error instanceof ApiError && error.status === 422) {
        const validationErrors = parseValidationErrors(error);
        if (validationErrors.length > 0) {
          validationErrors.forEach((errorMsg) => {
            toast.error(errorMsg, { duration: 6000 });
          });
        } else {
          toast.error(
            error.message || "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
          );
        }
      } else if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Không thể thêm phòng. Vui lòng thử lại.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-slate-600">Đang tải...</p>
      </div>
    );
  }

  if (!property) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/owner/properties/${propertyId}?tab=units`}
          className="text-sm font-semibold text-[#3368a0] hover:underline"
        >
          ← Quay lại danh sách căn
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Thêm phòng mới</h1>
        <p className="mt-1 text-sm text-slate-600">{property.name}</p>
      </div>

      <form onSubmit={saveNewRooms} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Thiết lập số lượng và tên
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Số lượng
              <input
                type="number"
                min={1}
                max={50}
                value={unitCount}
                onChange={(event) =>
                  updateRoomPlan(
                    Number(event.target.value) || 1,
                    unitPrefix,
                    startNumber,
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tiền tố
              <input
                value={unitPrefix}
                onChange={(event) =>
                  updateRoomPlan(unitCount, event.target.value, startNumber)
                }
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Số bắt đầu
              <input
                type="number"
                min={1}
                value={startNumber}
                onChange={(event) =>
                  updateRoomPlan(
                    unitCount,
                    unitPrefix,
                    Number(event.target.value) || 1,
                  )
                }
                className={fieldClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Chi tiết phòng
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Chọn một phòng để sửa. Nút bên dưới sao chép phòng đang xem sang
                các phòng chưa chỉnh.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {activeRoom + 1} / {rooms.length}
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Phòng sẽ thêm"
            className="mt-4 flex gap-2 overflow-x-auto pb-2"
          >
            {rooms.map((room, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={activeRoom === index}
                onClick={() => setActiveRoom(index)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${activeRoom === index ? "border-[#3368a0] bg-[#3368a0] text-white" : "border-slate-200 bg-white text-slate-700"}`}
              >
                {room.label || `Phòng ${index + 1}`}
              </button>
            ))}
          </div>
          {rooms.map((room, index) => (
            <fieldset
              key={index}
              hidden={activeRoom !== index}
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Tên phòng
                <input
                  value={room.label}
                  onChange={(event) =>
                    updateRoom(index, { label: event.target.value }, false)
                  }
                  required
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Loại phòng
                <select
                  value={room.unit_kind}
                  onChange={(event) =>
                    updateRoom(index, { unit_kind: event.target.value })
                  }
                  className={fieldClass}
                >
                  <option value="ROOM">Phòng</option>
                  <option value="STUDIO">Studio</option>
                  <option value="APARTMENT">Căn hộ</option>
                  <option value="HOUSE">Nhà</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Diện tích (m²)
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={room.area_m2}
                  onChange={(event) =>
                    updateRoom(index, { area_m2: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Tầng
                <input
                  value={room.floor}
                  onChange={(event) =>
                    updateRoom(index, { floor: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phòng ngủ
                <input
                  type="number"
                  min="0"
                  value={room.bedrooms}
                  onChange={(event) =>
                    updateRoom(index, { bedrooms: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phòng tắm
                <input
                  type="number"
                  min="0"
                  value={room.bathrooms}
                  onChange={(event) =>
                    updateRoom(index, { bathrooms: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <fieldset className="text-sm font-medium text-slate-700">
                <legend className="mb-2">Loại phòng tắm</legend>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`bathroom-arrangement-${index}`}
                      value="PRIVATE"
                      checked={room.bathroom_arrangement === "PRIVATE"}
                      onChange={(event) =>
                        updateRoom(index, {
                          bathroom_arrangement: event.target.value as
                            "PRIVATE" | "SHARED",
                        })
                      }
                      className="h-4 w-4 text-blue-600"
                    />
                    <span>Riêng</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`bathroom-arrangement-${index}`}
                      value="SHARED"
                      checked={room.bathroom_arrangement === "SHARED"}
                      onChange={(event) =>
                        updateRoom(index, {
                          bathroom_arrangement: event.target.value as
                            "PRIVATE" | "SHARED",
                        })
                      }
                      className="h-4 w-4 text-blue-600"
                    />
                    <span>Chung</span>
                  </label>
                </div>
              </fieldset>
              <label className="text-sm font-medium text-slate-700">
                Số người tối đa
                <input
                  type="number"
                  min="1"
                  value={room.max_occupants}
                  onChange={(event) =>
                    updateRoom(index, { max_occupants: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Giá thuê (₫/tháng)
                <input
                  type="number"
                  min="0"
                  value={room.rent}
                  onChange={(event) =>
                    updateRoom(index, { rent: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Tiền cọc (₫)
                <input
                  type="number"
                  min="0"
                  value={room.deposit}
                  onChange={(event) =>
                    updateRoom(index, { deposit: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Thuê tối thiểu (tháng)
                <input
                  type="number"
                  min="1"
                  value={room.minimum_rental_months}
                  onChange={(event) =>
                    updateRoom(index, {
                      minimum_rental_months: event.target.value,
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Mô tả
                <textarea
                  rows={3}
                  value={room.description}
                  onChange={(event) =>
                    updateRoom(index, { description: event.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => applyRoomToEmpty(index)}
                  className={secondaryButtonClass}
                >
                  Áp dụng cho các phòng chưa chỉnh riêng
                </button>
              </div>
            </fieldset>
          ))}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm text-slate-600">
            Kiểm tra lại thông tin trước khi lưu. Bạn có thể chỉnh sau.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/owner/properties/${propertyId}?tab=units`}
              className={secondaryButtonClass}
            >
              Hủy
            </Link>
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? "Đang lưu…" : `Thêm ${rooms.length} phòng`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function AddUnitsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <p className="text-slate-600">Đang tải...</p>
        </div>
      }
    >
      <AddUnitsPageContent />
    </Suspense>
  );
}
