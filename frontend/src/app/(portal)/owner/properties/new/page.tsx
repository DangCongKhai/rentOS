"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useState,
  useRef,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";
import {
  ApiError,
  createOwnerProperty,
  createOwnerUnitBatch,
  getAmenityCatalog,
  getOwnerProperty,
  updateOwnerUnit,
  type AmenityCatalogEntry,
  type AmenityDocument,
  type OwnerPropertyDetail,
} from "@/lib/auth-api";
import { WizardProgress } from "./components/wizard-progress";
import { BasicInfoStep } from "./components/basic-info-step";
import { RentalArrangementStep } from "./components/rental-arrangement-step";
import { AmenitiesStep } from "./components/amenities-step";
import { PoliciesStep } from "./components/policies-step";
import { ReviewStep, type ReviewStepFormData } from "./components/review-step";
import { emptyRoom, type RoomDraft } from "./components/shared/types";
import {
  primaryButton,
  secondaryButton,
  shellClass,
} from "./components/shared/form-styles";

function extractFormData(form: HTMLFormElement | null): ReviewStepFormData {
  function read(name: string): string {
    if (!form) return "";
    const value = form.elements.namedItem(name);
    if (
      value instanceof HTMLInputElement ||
      value instanceof HTMLTextAreaElement ||
      value instanceof HTMLSelectElement
    ) {
      return value.value.trim();
    }
    return "";
  }

  return {
    name: read("name"),
    propertyType: read("property_type"),
    description: read("description"),
    city: read("city"),
    ward: read("ward"),
    addressLine: read("address_line"),
    pets: read("pets"),
    smoking: read("smoking"),
    sharedRules: read("shared_rules"),
    rent: read("rent"),
    area_m2: read("area_m2"),
    custom_amenities: read("custom_amenities"),
  };
}

const stages = [
  "Thông tin cơ bản",
  "Hình thức thuê",
  "Tiện ích chung",
  "Quy định và nội quy",
  "Kiểm tra lại",
];

const stageDescriptions = [
  "Cung cấp tên, loại hình, mô tả và địa chỉ của bất động sản.",
  "Chọn cách cho thuê, nhập giá mặc định và tùy chỉnh riêng từng căn nếu cần.",
  "Chọn tiện ích cho toàn bộ bất động sản hoặc riêng trong căn/phòng.",
  "Thiết lập chính sách chung và nội quy bổ sung cho từng căn.",
  "Xem lại thông tin và tạo bản nháp để tiếp tục hoàn thiện.",
];

function read(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function numberFromForm(
  form: FormData,
  name: string,
  fallback: number | null = null,
): number | null {
  const value = read(form, name);
  return value === "" ? fallback : Number(value);
}

function documentFromForm(
  form: FormData,
  catalog: AmenityCatalogEntry[],
): AmenityDocument {
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) =>
    item.scopes.includes("shared"),
  )) {
    if (form.get(`amenity:${amenity.key}`) === "on") {
      const details = read(form, `amenity_details:${amenity.key}`);
      standard[amenity.key] = {
        enabled: true,
        ...(details ? { details } : {}),
      };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: read(form, "custom_amenities")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function unitAmenityDocumentFromForm(
  form: FormData,
  catalog: AmenityCatalogEntry[],
  excludedKeys: ReadonlySet<string> = new Set(),
): AmenityDocument {
  const standard: AmenityDocument["standard"] = {};
  for (const amenity of catalog.filter((item) =>
    item.scopes.includes("unit"),
  )) {
    if (
      form.get(`unit_amenity:${amenity.key}`) === "on" &&
      !excludedKeys.has(amenity.key)
    ) {
      const details = read(form, `unit_amenity_details:${amenity.key}`);
      standard[amenity.key] = {
        enabled: true,
        ...(details ? { details } : {}),
      };
    }
  }
  return {
    schema_version: 1,
    standard,
    custom: read(form, "unit_custom_amenities")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export default function NewOwnerPropertyPage() {
  const searchParams = useSearchParams();
  const freshKey = searchParams.get("fresh") || "default";

  return <NewOwnerPropertyWizard key={freshKey} />;
}

function NewOwnerPropertyWizard() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<AmenityCatalogEntry[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [createdProperty, setCreatedProperty] =
    useState<OwnerPropertyDetail | null>(null);
  const [rentalArrangement, setRentalArrangement] = useState<
    "WHOLE_SPACE" | "SEPARATE_UNITS"
  >("WHOLE_SPACE");
  const [unitCount, setUnitCount] = useState(1);
  const [unitPrefix, setUnitPrefix] = useState("Phòng");
  const [startNumber, setStartNumber] = useState(101);
  const [rooms, setRooms] = useState<RoomDraft[]>([emptyRoom("Phòng 101")]);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [sharedAmenityKeys, setSharedAmenityKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [amenityScope, setAmenityScope] = useState<"property" | "unit">(
    "property",
  );
  const [setupComplete, setSetupComplete] = useState(false);
  const [reviewFormData, setReviewFormData] = useState<ReviewStepFormData>({
    name: "",
    propertyType: "",
    description: "",
    city: "",
    ward: "",
    addressLine: "",
    pets: "",
    smoking: "",
    sharedRules: "",
    rent: "",
    area_m2: "",
    custom_amenities: "",
  });

  // Extract form data when navigating to review step
  useEffect(() => {
    if (step === 4) {
      setReviewFormData(extractFormData(formRef.current));
    }
  }, [step]);

  // Scroll to top when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [step]);

  useEffect(() => {
    let active = true;
    getAmenityCatalog()
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch(() => {
        if (active) setError("Không thể tải danh sách tiện nghi.");
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const unitLabels = rooms.map((room) => room.label);
  const normalizedLabels = unitLabels.map((label) =>
    label.trim().toLocaleLowerCase(),
  );
  const duplicateLabels = new Set(
    normalizedLabels.filter(
      (label, index) => label && normalizedLabels.indexOf(label) !== index,
    ),
  );

  function updateUnitDefaults(count: number, prefix: string, start: number) {
    const nextCount = Math.min(Math.max(count, 1), 50);
    setUnitCount(nextCount);
    setUnitPrefix(prefix);
    setStartNumber(start);
    setRooms((current) =>
      Array.from({ length: nextCount }, (_, index) => {
        const generated = `${prefix.trim() || "Phòng"} ${start + index}`;
        const existing = current[index];
        if (!existing) return emptyRoom(generated);
        return {
          ...existing,
          label: existing.labelEdited ? existing.label : generated,
        };
      }),
    );
    setActiveUnitIndex((current) => Math.min(current, nextCount - 1));
  }

  function updateRoom(
    index: number,
    patch: Partial<RoomDraft>,
    customized = true,
  ) {
    setRooms((current) =>
      current.map((room, roomIndex) =>
        roomIndex === index
          ? { ...room, ...patch, customized: customized || room.customized }
          : room,
      ),
    );
  }

  function applyRoomToEmpty(index: number) {
    const source = rooms[index];
    if (!source) return;
    setRooms((current) =>
      current.map((room, roomIndex) => {
        if (roomIndex === index || room.customized) return room;
        return {
          ...source,
          label: room.label,
          labelEdited: room.labelEdited,
          customized: false,
        };
      }),
    );
  }

  function goNext(form: HTMLFormElement) {
    if (step === 0 && addressBlocksProgress()) return;
    if (!form.reportValidity()) return;

    if (
      step === 1 &&
      rentalArrangement === "SEPARATE_UNITS" &&
      (!unitLabels.length ||
        duplicateLabels.size > 0 ||
        unitLabels.some((label) => !label.trim()))
    ) {
      setError(
        "Kiểm tra tên căn: cần ít nhất một tên và không được trùng nhau.",
      );
      return;
    }
    setError("");
    setFieldErrors({});
    setStep((current) => Math.min(current + 1, stages.length - 1));
  }

  function blockImplicitSubmit(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) return;
    if (target instanceof HTMLButtonElement) return;
    event.preventDefault();
  }

  function submitWizard(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function saveDraft(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    if (!read(form, "name")) {
      setError("Nhập tên bất động sản ở bước 1 trước khi lưu bản nháp.");
      setStep(0);
      return;
    }

    setSaving(true);
    setError("");
    setFieldErrors({});
    let property = createdProperty;
    try {
      if (!property) {
        property = await createOwnerProperty({
          client_operation_id: crypto.randomUUID(),
          name: read(form, "name"),
          property_type: read(form, "property_type"),
          rental_arrangement: rentalArrangement,
          address_line: read(form, "address_line") || null,
          city: read(form, "city") || null,
          ward: read(form, "ward") || null,
          description: read(form, "description") || null,
          shared_amenities: documentFromForm(form, catalog),
          policies: {
            schema_version: 1,
            pets: read(form, "pets"),
            smoking: read(form, "smoking"),
            shared_rules: read(form, "shared_rules")
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          },
          ...(rentalArrangement === "WHOLE_SPACE"
            ? {
                area_m2: numberFromForm(form, "area_m2"),
                bedrooms: numberFromForm(form, "bedrooms", 0) ?? 0,
                bathrooms: numberFromForm(form, "bathrooms", 1) ?? 1,
                advertised_monthly_rent: numberFromForm(form, "rent"),
                deposit: numberFromForm(form, "deposit"),
                minimum_rental_months:
                  numberFromForm(form, "minimum_rental_months", 3) ?? 3,
                max_occupants: numberFromForm(form, "max_occupants", 1),
                unit_description:
                  read(form, "unit_description") ||
                  read(form, "description") ||
                  null,
                unit_amenities: unitAmenityDocumentFromForm(
                  form,
                  catalog,
                  sharedAmenityKeys,
                ),
              }
            : {}),
        });
        setCreatedProperty(property);
      }

      if (!setupComplete && property && createdProperty) {
        setError(
          "Bản nháp đã được tạo nhưng chưa hoàn tất các căn. Mở bất động sản để tiếp tục trong mục Danh sách căn.",
        );
        return;
      }

      if (!setupComplete) {
        if (!property)
          throw new Error("Property setup did not return a record.");
        const rent = numberFromForm(form, "rent");
        const deposit = numberFromForm(form, "deposit");
        const minMonths = numberFromForm(form, "minimum_rental_months", 3) ?? 3;
        const maxOccupants = numberFromForm(form, "max_occupants", 1);
        if (rentalArrangement === "SEPARATE_UNITS") {
          await createOwnerUnitBatch(property.id, {
            expected_content_revision: property.content_revision,
            client_operation_id: crypto.randomUUID(),
            units: rooms.map((room, index) => ({
              client_operation_id: crypto.randomUUID(),
              label: room.label.trim(),
              unit_kind: room.unit_kind || "ROOM",
              description: room.description.trim() || null,
              bedrooms: room.bedrooms === "" ? 0 : Number(room.bedrooms),
              bathrooms: room.bathrooms === "" ? 1 : Number(room.bathrooms),
              bathroom_arrangement: "PRIVATE",
              minimum_rental_months:
                room.minimum_rental_months === ""
                  ? minMonths
                  : Number(room.minimum_rental_months),
              advertised_monthly_rent:
                room.rent === "" ? null : Number(room.rent),
              deposit: room.deposit === "" ? null : Number(room.deposit),
              max_occupants:
                room.max_occupants === "" ? 1 : Number(room.max_occupants),
              area_m2: room.area_m2 === "" ? null : Number(room.area_m2),
              amenities: unitAmenityDocumentFromForm(
                form,
                catalog,
                sharedAmenityKeys,
              ),
              policy_overrides: {
                additional_rules: read(form, `new_${index}_additional_rules`)
                  .split("\n")
                  .map((rule) => rule.trim())
                  .filter(Boolean)
                  .filter(
                    (rule) =>
                      !read(form, "shared_rules")
                        .split("\n")
                        .some(
                          (sharedRule) =>
                            sharedRule
                              .trim()
                              .normalize("NFC")
                              .toLocaleLowerCase("vi") ===
                            rule.normalize("NFC").toLocaleLowerCase("vi"),
                        ),
                  ),
              },
            })),
          });
        } else {
          const wholeSpaceUnit = property.units.find(
            (unit) => !unit.archived_at,
          );
          if (wholeSpaceUnit) {
            const description =
              read(form, "unit_description") ||
              read(form, "description") ||
              null;
            const area = numberFromForm(form, "area_m2");
            await updateOwnerUnit(property.id, wholeSpaceUnit.id, {
              expected_content_revision: property.content_revision,
              description,
              is_marketed:
                Boolean(description?.trim()) &&
                area !== null &&
                rent !== null &&
                deposit !== null &&
                maxOccupants !== null,
              area_m2: area,
              bedrooms: numberFromForm(form, "bedrooms", 0) ?? 0,
              bathrooms: numberFromForm(form, "bathrooms", 1) ?? 1,
              bathroom_arrangement: "PRIVATE",
              advertised_monthly_rent: rent,
              deposit,
              minimum_rental_months: minMonths,
              max_occupants: maxOccupants,
              amenities: unitAmenityDocumentFromForm(
                form,
                catalog,
                sharedAmenityKeys,
              ),
            });
          }
        }
        property = await getOwnerProperty(property.id);
        setCreatedProperty(property);
        setSetupComplete(true);
      }

      router.push(`/owner/properties/${property.id}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors);
      } else {
        setError(
          property
            ? "Bản nháp đã được tạo nhưng có lỗi xảy ra. Vui lòng mở bất động sản để tiếp tục."
            : "Không thể tạo bất động sản. Vui lòng thử lại.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function addressBlocksProgress(): boolean {
    const addressInput = formRef.current?.querySelector(
      '[name="address_line"]',
    ) as HTMLInputElement | null;
    if (!addressInput?.validationMessage) return false;
    addressInput.reportValidity();
    addressInput.focus();
    return true;
  }

  function handleStepChange(newStep: number) {
    if (newStep > step && step === 0 && addressBlocksProgress()) return;
    setError("");
    setStep(newStep);
  }

  const visibleStages =
    rentalArrangement === "WHOLE_SPACE"
      ? [
          "Thông tin cơ bản",
          "Hình thức thuê",
          "Tiện ích",
          "Nội quy",
          "Kiểm tra lại",
        ]
      : stages;
  const visibleStageDescriptions =
    rentalArrangement === "WHOLE_SPACE"
      ? [
          stageDescriptions[0],
          "Chọn cho thuê cả căn và nhập giá, diện tích, số người.",
          "Chọn tiện ích của căn này.",
          "Thiết lập thú cưng, hút thuốc và nội quy của căn này.",
          stageDescriptions[4],
        ]
      : stageDescriptions;

  return (
    <section className="mx-auto w-full max-w-6xl py-3 sm:py-5">
      <p className="text-sm text-slate-500">
        Không gian quản lý / Chủ nhà /{" "}
        <Link
          href="/owner/properties"
          className="text-[#3368a0] hover:underline"
        >
          Bất động sản
        </Link>{" "}
        / Tạo bất động sản
      </p>
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3368a0]">
          Tạo bản nháp
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Thêm bất động sản mới
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Cung cấp thông tin cơ bản, hình thức cho thuê và tiện ích để bắt đầu
          tìm người thuê.
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={submitWizard}
        onKeyDown={blockImplicitSubmit}
        className="mt-6 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start"
      >
        <WizardProgress
          stages={visibleStages}
          currentStep={step}
          onStepChange={handleStepChange}
        />

        <div
          className={`${shellClass} flex max-h-[calc(100dvh-18rem)] flex-col self-start`}
        >
          <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
              {visibleStages[step]}
            </h2>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              {visibleStageDescriptions[step]}
            </p>
          </header>
          <div
            ref={contentRef}
            className="m-4 min-h-0 flex-1 space-y-5 overflow-y-auto rounded-xl bg-slate-50 p-4 sm:m-5 sm:p-5"
          >
            <div hidden={step !== 0}>
              <BasicInfoStep />
            </div>

            <div hidden={step !== 1}>
              <RentalArrangementStep
                rentalArrangement={rentalArrangement}
                onRentalArrangementChange={setRentalArrangement}
                unitCount={unitCount}
                unitPrefix={unitPrefix}
                startNumber={startNumber}
                rooms={rooms}
                activeUnitIndex={activeUnitIndex}
                duplicateLabels={duplicateLabels}
                onUpdateUnitDefaults={updateUnitDefaults}
                onUpdateRoom={updateRoom}
                onApplyRoomToEmpty={applyRoomToEmpty}
                onSetActiveUnit={setActiveUnitIndex}
              />
            </div>

            <div hidden={step !== 2}>
              <AmenitiesStep
                catalog={catalog}
                loadingCatalog={loadingCatalog}
                sharedAmenityKeys={sharedAmenityKeys}
                onSharedAmenityKeysChange={setSharedAmenityKeys}
                amenityScope={amenityScope}
                onAmenityScopeChange={setAmenityScope}
                rentalArrangement={rentalArrangement}
              />
            </div>

            <div hidden={step !== 3}>
              <PoliciesStep
                rentalArrangement={rentalArrangement}
                unitLabels={unitLabels}
                activeUnitIndex={activeUnitIndex}
                onSetActiveUnit={setActiveUnitIndex}
              />
            </div>

            <div hidden={step !== 4}>
              <ReviewStep
                formData={reviewFormData}
                rentalArrangement={rentalArrangement}
                rooms={rooms}
                sharedAmenityKeys={sharedAmenityKeys}
                catalog={catalog}
                onNavigateToStep={handleStepChange}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {error}
                {createdProperty && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/owner/properties/${createdProperty.id}`)
                    }
                    className="ml-2 font-semibold underline"
                  >
                    Mở bất động sản đã tạo
                  </button>
                )}
              </div>
            )}
            {Object.entries(fieldErrors).length > 0 && (
              <ul
                role="alert"
                className="mt-3 list-disc rounded-xl border border-rose-200 bg-rose-50 px-8 py-3 text-sm text-rose-800"
              >
                {Object.entries(fieldErrors).map(([field, messages]) => (
                  <li key={field}>
                    {field}: {messages[0]}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => router.push("/owner/properties")}
              className={secondaryButton}
            >
              Hủy
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                aria-label="Quay lại bước trước"
                title="Quay lại bước trước"
                disabled={step === 0}
                onClick={() => {
                  setError("");
                  setStep((current) => Math.max(current - 1, 0));
                }}
                className={`${secondaryButton} size-11 px-0 text-xl disabled:opacity-40`}
              >
                <span aria-hidden="true">←</span>
              </button>
              {step < stages.length - 1 ? (
                <button
                  type="button"
                  aria-label="Đến bước tiếp theo"
                  title="Đến bước tiếp theo"
                  onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (form) goNext(form);
                  }}
                  className={`${primaryButton} size-11 px-0 text-xl`}
                >
                  <span aria-hidden="true">→</span>
                </button>
              ) : createdProperty ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/owner/properties/${createdProperty.id}`)
                  }
                  className={primaryButton}
                >
                  Mở bất động sản đã tạo
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (form) void saveDraft(form);
                  }}
                  className={primaryButton}
                >
                  {saving ? "Đang lưu…" : "Tạo bản nháp"}
                </button>
              )}
            </div>
          </footer>
        </div>
      </form>
    </section>
  );
}
