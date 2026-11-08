"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DateField } from "@/components/ui/date-field";
import {
  ApiError,
  getOwnerRentalRequest,
  proposeOwnerTenancy,
  type OwnerRentalRequestDetail,
  type OwnerProposalUnit,
  type PropertyPolicies,
} from "@/lib/auth-api";

const steps = ["Chọn căn", "Điều khoản", "Tài liệu", "Xem lại và gửi"];

const petOptions = [
  ["NOT_ALLOWED", "Không cho phép"],
  ["WITH_APPROVAL", "Cần phê duyệt"],
  ["ALLOWED", "Được phép"],
  ["ASK_OWNER", "Trao đổi với chủ nhà"],
] as const;

const smokingOptions = [
  ["NOT_ALLOWED", "Không cho phép"],
  ["OUTDOOR_ONLY", "Chỉ ngoài trời"],
  ["ALLOWED", "Được phép"],
  ["ASK_OWNER", "Trao đổi với chủ nhà"],
] as const;

function moneyLabel(value: string): string {
  if (!value) return "—";
  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

function cleanMoney(value: string): string {
  return value.replace(/\D/g, "");
}

function unitDefaults(
  unit: OwnerProposalUnit,
  propertyPolicies: PropertyPolicies,
) {
  return {
    rent: String(unit.monthly_rent ?? ""),
    deposit: String(unit.deposit_amount ?? ""),
    pets: unit.policy_overrides?.pets ?? propertyPolicies.pets,
    smoking: unit.policy_overrides?.smoking ?? propertyPolicies.smoking,
    rulesText: (unit.policy_overrides?.additional_rules ?? []).join("\n"),
  };
}

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export default function OwnerTenancyProposalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const operationId = useRef<string | null>(null);

  const [detail, setDetail] = useState<OwnerRentalRequestDetail | null>(null);
  const [step, setStep] = useState(0);
  const [unitId, setUnitId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [pets, setPets] = useState("");
  const [smoking, setSmoking] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await getOwnerRentalRequest(id);

        if (!active) return;

        setDetail(result);
        setStartDate(result.request.desired_move_in_date.slice(0, 10));
        setEndDate(result.request.desired_end_date.slice(0, 10));

        const available = result.units.find(
          (unit) =>
            unit.operational_status === "READY" && !unit.has_date_conflict,
        );
        const preferred = result.units.find(
          (unit) =>
            unit.id === result.request.preferred_unit_id &&
            unit.operational_status === "READY" &&
            !unit.has_date_conflict,
        );

        const initialUnit = preferred ?? available;
        setUnitId(initialUnit?.id ?? "");

        if (initialUnit) {
          const defaults = unitDefaults(initialUnit, result.property_policies);
          setRent(defaults.rent);
          setDeposit(defaults.deposit);
          setPets(defaults.pets);
          setSmoking(defaults.smoking);
          setRulesText(defaults.rulesText);
        }
      } catch (caught) {
        if (!active) return;

        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }

        setError(
          caught instanceof ApiError
            ? caught.message
            : "Không thể tải dữ liệu đề xuất. Vui lòng thử lại.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [id, retry, router]);

  const selectedUnit = detail?.units.find((unit) => unit.id === unitId) ?? null;

  const availableUnits =
    detail?.units.filter(
      (unit) => unit.operational_status === "READY" && !unit.has_date_conflict,
    ) ?? [];

  function validateStep(): boolean {
    setError("");

    if (step === 0 && !selectedUnit) {
      setError("Chọn một căn đang sẵn sàng và không bị trùng lịch.");
      return false;
    }

    if (step === 1) {
      if (!startDate || !endDate || endDate <= startDate) {
        setError("Ngày kết thúc phải sau ngày bắt đầu.");
        return false;
      }
      if (!Number(rent) || Number(rent) < 1) {
        setError("Giá thuê phải lớn hơn 0.");
        return false;
      }
      if (deposit === "" || Number(deposit) < 0) {
        setError("Nhập tiền cọc bằng 0 hoặc lớn hơn.");
        return false;
      }
      if (!pets || !smoking) {
        setError("Chọn thỏa thuận về thú cưng và hút thuốc.");
        return false;
      }
    }

    if (step === 2) {
      if (!document) {
        setError("Chọn tài liệu hợp đồng PDF.");
        return false;
      }
      if (!isPdf(document)) {
        setError("Tài liệu hợp đồng phải là tệp PDF.");
        return false;
      }
      if (document.size > 10 * 1024 * 1024) {
        setError("Tài liệu PDF không được vượt quá 10 MB.");
        return false;
      }
    }

    return true;
  }

  async function submitProposal() {
    if (!detail || !selectedUnit || !document) return;

    if (!acknowledged) {
      setError("Xác nhận đã kiểm tra chính xác phiên bản đề xuất này.");
      return;
    }

    setPending(true);
    setError("");

    try {
      operationId.current ??= crypto.randomUUID();

      const result = await proposeOwnerTenancy(id, {
        client_operation_id: operationId.current,
        unit_id: selectedUnit.id,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: Number(rent),
        deposit_amount: Number(deposit),
        policies_snapshot: {
          property: detail.property_policies,
          unit: {
            pets,
            smoking,
            additional_rules: rulesText
              .split(/\r?\n/)
              .map((rule) => rule.trim())
              .filter(Boolean),
          },
        },
        agreement_document: document,
      });

      router.push(`/owner/tenancies/${result.tenancy_id}`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldErrors = Object.values(caught.errors).flat();
        setError([caught.message, ...fieldErrors].filter(Boolean).join(" "));

        if (caught.status === 409) setStep(0);
      } else {
        setError("Không gửi được đề xuất. Vui lòng thử lại.");
      }
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-1 py-6">
        <div
          aria-busy="true"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
        >
          Đang tải dữ liệu đề xuất…
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="mx-auto w-full max-w-6xl px-1 py-6">
        <Link
          href={`/owner/requests/${encodeURIComponent(id)}`}
          className="text-sm font-semibold text-[#285584] hover:underline"
        >
          ← Quay lại yêu cầu thuê
        </Link>
        <p role="alert" className="mt-5 text-sm text-rose-700">
          {error || "Không tìm thấy yêu cầu thuê."}
        </p>
        {error && (
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-[#285584] underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Thử lại
          </button>
        )}
      </section>
    );
  }

  const request = detail.request;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-1 py-4 sm:px-2 sm:py-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/owner/requests/${encodeURIComponent(id)}`}
          className="font-semibold text-[#3368a0] hover:underline"
        >
          Yêu cầu thuê
        </Link>
        <span aria-hidden="true" className="text-slate-400">
          /
        </span>
        <span className="text-slate-500">Tạo đề xuất</span>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3368a0]">
          Tạo bản đề xuất
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          Đề xuất thuê cho {request.contact_name}
        </h1>
      </header>

      <ol
        aria-label="Các bước tạo đề xuất"
        className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-4"
      >
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={`flex min-h-12 items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold sm:text-sm ${
              step === index
                ? "border-[#3368a0] text-[#285584]"
                : index < step
                  ? "border-emerald-500 text-slate-700"
                  : "border-transparent text-slate-500"
            }`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                index < step
                  ? "bg-emerald-100 text-emerald-800"
                  : step === index
                    ? "bg-[#3368a0] text-white"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {index < step ? "✓" : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (step === 3) {
              void submitProposal();
              return;
            }
            if (validateStep()) setStep((current) => current + 1);
          }}
        >
          {step === 0 && (
            <fieldset className="space-y-3">
              <legend className="text-lg font-bold text-slate-900">
                Chọn căn cho khoảng ngày {startDate} – {endDate}
              </legend>
              <p className="text-sm text-slate-500">
                Chỉ các căn sẵn sàng, không bị trùng lịch mới có thể được chọn.
                Căn ưu tiên của người thuê được đánh dấu nếu còn phù hợp.
              </p>

              {detail.units.map((unit) => {
                const available =
                  unit.operational_status === "READY" &&
                  !unit.has_date_conflict;
                const selected = unit.id === unitId;

                return (
                  <label
                    key={unit.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 ${
                      !available
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : selected
                          ? "border-[#3368a0] bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="unit"
                        value={unit.id}
                        checked={selected}
                        disabled={!available}
                        onChange={() => {
                          setUnitId(unit.id);
                          const defaults = unitDefaults(
                            unit,
                            detail.property_policies,
                          );
                          setRent(defaults.rent);
                          setDeposit(defaults.deposit);
                          setPets(defaults.pets);
                          setSmoking(defaults.smoking);
                          setRulesText(defaults.rulesText);
                        }}
                        className="mt-1 accent-[#3368a0]"
                      />
                      <span>
                        <span className="block font-semibold text-slate-900">
                          {unit.label}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-2 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 ${
                              available
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {unit.has_date_conflict
                              ? "Đã có lịch thuê"
                              : unit.operational_status === "READY"
                                ? "Còn trống"
                                : unit.operational_status === "MAINTENANCE"
                                  ? "Đang bảo trì"
                                  : "Ngừng cho thuê"}
                          </span>
                          {unit.id === request.preferred_unit_id && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">
                              Căn ưu tiên
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold text-slate-800">
                      {moneyLabel(String(unit.monthly_rent ?? ""))}
                      <span className="block text-xs font-normal text-slate-500">
                        /tháng
                      </span>
                    </span>
                  </label>
                );
              })}

              {availableUnits.length === 0 && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  Không có căn sẵn sàng cho khoảng ngày này. Hãy kiểm tra lại
                  lịch và trạng thái căn.
                </p>
              )}
            </fieldset>
          )}

          {step === 1 && selectedUnit && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Điều khoản</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Nhập giá thuê cuối cùng và các quy định đã thỏa thuận với
                  người thuê.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  name="start_date"
                  label="Ngày bắt đầu"
                  defaultValue={request.desired_move_in_date.slice(0, 10)}
                  picker
                  onValueChange={setStartDate}
                />
                <DateField
                  name="end_date"
                  label="Ngày kết thúc"
                  defaultValue={request.desired_end_date.slice(0, 10)}
                  picker
                  onValueChange={setEndDate}
                />

                <MoneyInput
                  label="Giá thuê hằng tháng (₫)"
                  value={rent}
                  onChange={setRent}
                  required
                />
                <MoneyInput
                  label="Tiền cọc (₫)"
                  value={deposit}
                  onChange={setDeposit}
                  required
                />
              </div>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">
                  Quy định đã thỏa thuận
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Giá trị mặc định lấy từ bất động sản và căn đã chọn. Điều
                  chỉnh theo thỏa thuận cuối cùng.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <PolicySelect
                    label="Thú cưng"
                    value={pets}
                    options={petOptions}
                    onChange={setPets}
                  />
                  <PolicySelect
                    label="Hút thuốc"
                    value={smoking}
                    options={smokingOptions}
                    onChange={setSmoking}
                  />
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-800">
                    Nội quy chung của bất động sản
                  </p>
                  <p className="mt-1 text-slate-600">
                    {detail.property_policies.shared_rules.length
                      ? detail.property_policies.shared_rules.join(" · ")
                      : "Không có nội quy chung"}
                  </p>
                </div>

                <label className="mt-4 grid gap-1.5 text-sm font-semibold text-slate-700">
                  Nội quy bổ sung riêng cho căn đã thỏa thuận
                  <textarea
                    value={rulesText}
                    onChange={(event) => setRulesText(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-normal text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
                    placeholder="Mỗi dòng một nội quy"
                  />
                </label>
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Tài liệu hợp đồng
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tải lên bản PDF sẽ được lưu cùng phiên bản đề xuất này.
                </p>
              </div>

              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-slate-50 p-6 text-center hover:bg-blue-50">
                <span className="text-2xl text-[#3368a0]" aria-hidden="true">
                  ↑
                </span>
                <span className="mt-2 font-semibold text-slate-800">
                  Kéo thả tài liệu vào đây hoặc chọn tệp
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  PDF · tối đa 10 MB
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(event) =>
                    setDocument(event.target.files?.[0] ?? null)
                  }
                />
                {document && (
                  <span className="mt-3 break-all text-sm font-medium text-[#285584]">
                    {document.name}
                  </span>
                )}
              </label>
            </div>
          )}

          {step === 3 && selectedUnit && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Xem lại và gửi
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Kiểm tra toàn bộ thông tin trước khi gửi cho người thuê xác
                  nhận.
                </p>
              </div>

              <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <dt className="text-slate-500">Người thuê</dt>
                <dd className="font-medium text-slate-900">
                  {request.contact_name}
                </dd>

                <dt className="text-slate-500">Căn thuê</dt>
                <dd className="font-medium text-slate-900">
                  {selectedUnit.label}
                </dd>

                <dt className="text-slate-500">Thời hạn</dt>
                <dd className="text-slate-800">
                  {startDate} – {endDate}
                </dd>

                <dt className="text-slate-500">Giá thuê</dt>
                <dd className="text-slate-800">{moneyLabel(rent)} /tháng</dd>

                <dt className="text-slate-500">Tiền cọc</dt>
                <dd className="text-slate-800">{moneyLabel(deposit)}</dd>

                <dt className="text-slate-500">Thú cưng</dt>
                <dd className="text-slate-800">
                  {petOptions.find(([value]) => value === pets)?.[1] ?? pets}
                </dd>

                <dt className="text-slate-500">Hút thuốc</dt>
                <dd className="text-slate-800">
                  {smokingOptions.find(([value]) => value === smoking)?.[1] ??
                    smoking}
                </dd>

                <dt className="text-slate-500">Tài liệu</dt>
                <dd className="break-all text-slate-800">
                  {document?.name ?? "Chưa chọn"}
                </dd>
              </dl>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 size-4 accent-[#3368a0]"
                />
                <span>
                  Tôi xác nhận đây là phiên bản chính xác gồm các điều khoản và
                  tài liệu tôi muốn gửi cho người thuê.
                </span>
              </label>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep((current) => Math.max(0, current - 1));
              }}
              disabled={step === 0 || pending}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === 0 ? "Hủy" : "Quay lại"}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (validateStep()) setStep((current) => current + 1);
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584]"
              >
                Tiếp tục
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending || !acknowledged}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Đang gửi…" : "Gửi đề xuất kỳ thuê"}
              </button>
            )}
          </div>
        </form>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Tóm tắt trực tiếp
          </h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Người thuê</dt>
              <dd className="font-medium text-slate-900">
                {request.contact_name}
              </dd>
              <dd className="text-xs text-slate-500">
                {request.contact_phone}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500">Căn thuê</dt>
              <dd className="font-medium text-slate-900">
                {selectedUnit?.label ?? "Chưa chọn"}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500">Thời hạn</dt>
              <dd className="text-slate-800">
                {startDate || "—"} – {endDate || "—"}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500">Giá thuê</dt>
              <dd className="font-medium text-slate-900">
                {moneyLabel(rent)} /tháng
              </dd>
            </div>
          </dl>

          <p className="border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
            Sau khi gửi, căn được giữ trong thời gian chờ người thuê xác nhận
            phiên bản hợp đồng.
          </p>
        </aside>
      </div>
    </section>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        value={value ? Number(value).toLocaleString("vi-VN") : ""}
        onChange={(event) => onChange(cleanMoney(event.target.value))}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base font-normal text-slate-900 outline-none focus:border-[#3368a0] focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function PolicySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm font-normal text-slate-900"
      >
        <option value="">Chọn quy định</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
