"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { DateField } from "@/components/ui/date-field";
import type { ListingDetail } from "@/features/discovery/listings-api";
import { ApiError } from "@/lib/auth-api";
import { submitRentalRequest } from "@/lib/rental-requests-api";
import { describeDuration, dong, minimumMonths, placeLine, rentBounds } from "./listing-format";

const labelClass = "grid gap-1 text-sm font-medium text-heading";
const controlClass = "w-full rounded-xl border border-border-default bg-surface-card px-4 text-base font-normal focus:border-action-primary focus:ring-4 focus:ring-action-primary/15 focus:outline-none aria-invalid:border-rose-400";
const messageLimit = 500;
const nextSteps = [
  "Chủ nhà gọi điện trao đổi với bạn.",
  "Chủ nhà gửi đề xuất hợp đồng.",
  "Bạn xem và xác nhận hợp đồng.",
];

type Errors = Partial<Record<"name" | "phone" | "start" | "end" | "unit" | "message", string>>;

export function RentalRequestForm({
  listing,
  isSignedIn,
  onCancel,
}: {
  listing: ListingDetail;
  isSignedIn: boolean;
  onCancel: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const lastAttempt = useRef<{ payload: string; operationId: string } | null>(null);
  const [message, setMessage] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [unitId, setUnitId] = useState("");
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photo = listing.gallery[0]?.url ?? listing.units[0]?.photos[0]?.url;
  const rent = rentBounds(listing.units);
  const minMonths = listing.units.find((unit) => unit.id === unitId)?.minimum_rental_months ?? minimumMonths(listing.units);
  const duration = start && end && end >= start ? describeDuration(start, end) : null;
  const calendarIcon = <Image src="/images/rental-request/calendar.svg" alt="" width={12} height={12} />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || submitted) return;
    setSubmitError("");
    if (!isSignedIn) {
      router.push("/login");
      return;
    }

    const values = new FormData(event.currentTarget);
    const name = String(values.get("contact_name") ?? "").trim();
    const phone = String(values.get("contact_phone") ?? "").replace(/[\s().-]/g, "");
    const nextErrors: Errors = {};

    if (!name) nextErrors.name = "Nhập họ và tên liên hệ.";
    if (!phone) nextErrors.phone = "Nhập số điện thoại.";
    else if (!/^\+?\d{8,15}$/.test(phone)) {
      nextErrors.phone = "Nhập số điện thoại hợp lệ.";
    }
    if (!start) nextErrors.start = "Chọn ngày dọn vào mong muốn.";
    if (!end) nextErrors.end = "Chọn ngày kết thúc mong muốn.";
    else if (start && end < start) nextErrors.end = "Ngày kết thúc phải từ ngày dọn vào trở đi.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      listing_id: listing.id,
      contact_name: name,
      contact_phone: phone,
      desired_move_in_date: start,
      desired_end_date: end,
      preferred_unit_id: unitId || null,
      message: message.trim(),
    };
    const payload = JSON.stringify(input);
    if (lastAttempt.current?.payload !== payload) {
      lastAttempt.current = { payload, operationId: crypto.randomUUID() };
    }

    setSubmitting(true);
    try {
      await submitRentalRequest({ ...input, client_operation_id: lastAttempt.current.operationId });
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        setErrors({
          name: error.errors.contact_name?.[0],
          phone: error.errors.contact_phone?.[0],
          start: error.errors.desired_move_in_date?.[0],
          end: error.errors.desired_end_date?.[0],
          unit: error.errors.preferred_unit_id?.[0],
          message: error.errors.message?.[0],
        });
        setSubmitError(error.errors.listing_id?.[0] ?? "Vui lòng kiểm tra lại thông tin yêu cầu thuê.");
      } else {
        setSubmitError(error instanceof ApiError && error.status < 500
          ? error.message
          : "Chưa xác nhận được kết quả gửi yêu cầu. Bạn có thể thử gửi lại.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" aria-label="Gửi yêu cầu thuê" onSubmit={handleSubmit} onChange={() => setSubmitError("")}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-8">
        <fieldset disabled={submitting || submitted} className="grid min-w-0 gap-6">
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-app p-4 sm:flex-nowrap sm:gap-5">
            <div className="relative grid h-[88px] w-32 shrink-0 place-items-center overflow-hidden rounded-xl bg-action-primary/10">
              {photo && failedPhoto !== photo ? (
                <Image src={photo} alt="" fill sizes="128px" className="object-cover" onError={() => setFailedPhoto(photo)} />
              ) : (
                <span className="text-xs text-secondary">Chưa có ảnh</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-heading">{listing.title}</p>
              <p className="mt-1 text-sm text-secondary">{placeLine(listing)}</p>
            </div>
            {rent ? (
              <div className="w-full shrink-0 sm:w-auto sm:text-right">
                <p className="text-xs text-secondary">Giá quảng cáo</p>
                <p className="mt-1 text-lg font-semibold text-action-primary sm:text-xl">
                  {rent.min !== rent.max ? "Từ " : ""}{dong(rent.min)}
                  <span className="text-sm font-normal text-secondary">/tháng</span>
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-5">
            <div className="grid items-start gap-4 sm:grid-cols-2 sm:gap-6">
              <label className={labelClass}>
                Họ và tên liên hệ
                <input
                  name="contact_name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${id}-name-error` : undefined}
                  className={`h-12 ${controlClass}`}
                />
                {errors.name ? <span id={`${id}-name-error`} role="alert" className="text-sm text-rose-700">{errors.name}</span> : null}
              </label>
              <label className={labelClass}>
                Số điện thoại
                <input
                  name="contact_phone"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? `${id}-phone-hint ${id}-phone-error` : `${id}-phone-hint`}
                  className={`h-12 ${controlClass}`}
                />
                {errors.phone ? <span id={`${id}-phone-error`} role="alert" className="text-sm text-rose-700">{errors.phone}</span> : null}
                <span id={`${id}-phone-hint`} className="mt-1 text-[13px] font-normal text-secondary">
                  Chúng tôi không xác minh số điện thoại. Chủ nhà sẽ gọi vào số này.
                </span>
              </label>
            </div>

            <div className="grid gap-2">
              <div className="grid items-start gap-4 sm:grid-cols-2 sm:gap-6">
                <DateField name="desired_move_in_date" label="Ngày dọn vào mong muốn" picker pickerIcon={calendarIcon} error={errors.start} onValueChange={(value) => {
                  setStart(value);
                  setSubmitError("");
                }} />
                <DateField name="desired_end_date" label="Ngày kết thúc mong muốn" picker pickerIcon={calendarIcon} error={errors.end} onValueChange={(value) => {
                  setEnd(value);
                  setSubmitError("");
                }} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-secondary">
                {duration ? <span className="rounded-lg bg-action-primary/10 px-3 py-1 text-xs font-semibold text-action-primary">{duration}</span> : null}
                {minMonths > 0 ? <span>Thuê dài hạn, tối thiểu {minMonths} tháng</span> : null}
              </div>
            </div>

            <PreferredUnitPicker units={listing.units} value={unitId} error={errors.unit} onChange={(value) => {
              setUnitId(value);
              setSubmitError("");
            }} />

            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor={`${id}-message`} className="text-sm font-medium text-heading">Lời nhắn (tùy chọn)</label>
                <span id={`${id}-message-count`} className="text-xs text-secondary">{message.length}/{messageLimit}</span>
              </div>
              <textarea
                id={`${id}-message`}
                name="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={messageLimit}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? `${id}-message-count ${id}-message-error` : `${id}-message-count`}
                placeholder="Chia sẻ thêm về nhu cầu thuê hoặc điều bạn muốn hỏi chủ nhà…"
                className={`min-h-[92px] resize-y py-3 ${controlClass}`}
              />
              {errors.message ? <span id={`${id}-message-error`} role="alert" className="text-sm text-rose-700">{errors.message}</span> : null}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-action-primary/10 p-4 text-sm">
            <Image src="/images/rental-request/info.svg" alt="" width={26} height={26} className="shrink-0" />
            <div>
              <p className="font-semibold text-heading">Gửi yêu cầu không đồng nghĩa với việc giữ chỗ.</p>
              <p className="mt-1 text-secondary">Chủ nhà sẽ liên hệ với bạn qua điện thoại.</p>
            </div>
          </div>

          <section className="grid gap-3">
            <h3 className="font-semibold text-heading">Điều gì xảy ra tiếp theo?</h3>
            <ol className="grid gap-3 sm:grid-cols-3 sm:gap-6">
              {nextSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-[13px] text-secondary">
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-app text-xs font-semibold text-action-primary">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </fieldset>
      </div>

      <div className="grid shrink-0 gap-2 border-t border-border-default bg-surface-card px-4 py-3 sm:px-8 sm:py-4">
        {submitError ? <p role="alert" className="text-sm text-rose-700">{submitError}</p> : null}
        {submitted ? (
          <p role="status" className="text-sm font-medium text-green-700">Đã gửi yêu cầu thuê.</p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={submitting} className="h-12 rounded-xl px-4 text-sm font-semibold text-heading hover:bg-surface-app disabled:opacity-60">
            {submitted ? "Đóng" : "Hủy"}
          </button>
          <button type="submit" disabled={submitting || submitted} className="h-12 rounded-xl bg-action-primary px-6 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60">
            {submitting ? "Đang gửi…" : submitted ? "Đã gửi" : "Gửi yêu cầu thuê"}
          </button>
        </div>
      </div>
    </form>
  );
}

function PreferredUnitPicker({
  units,
  value,
  error,
  onChange,
}: {
  units: ListingDetail["units"];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const options = [{ id: "", label: "Không ưu tiên" }, ...units];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === value));

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function closePicker() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className={labelClass}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          closePicker();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (open) {
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((index) => Math.min(options.length - 1, Math.max(0, index + direction)));
          } else {
            setActiveIndex(selectedIndex);
            setOpen(true);
          }
        } else if (open && (event.key === "Home" || event.key === "End")) {
          event.preventDefault();
          setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
        }
      }}
    >
      <span id={`${id}-label`}>Căn ưu tiên (không bắt buộc)</span>
      <button ref={trigger} type="button" aria-haspopup="listbox" aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-controls={open ? `${id}-options` : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        data-invalid={Boolean(error)}
        className={`flex h-12 items-center justify-between gap-3 text-left data-[invalid=true]:border-rose-400 ${controlClass}`}
        onClick={() => { setActiveIndex(selectedIndex); setOpen(!open); }}
      >
        <span id={`${id}-value`} className="truncate">{options[selectedIndex].label}</span>
        <Image src="/images/rental-request/chevron.svg" alt="" width={10} height={10} className={open ? "rotate-180" : undefined} />
      </button>
      {open ? (
        <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`}
          className="mt-1 grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-border-default bg-surface-card p-1.5 shadow-sm">
          {options.map((option, index) => (
            <button key={option.id} ref={(element) => { optionRefs.current[index] = element; }}
              type="button" role="option" aria-selected={index === selectedIndex} tabIndex={-1}
              className="rounded-lg px-3 py-2 text-left font-normal hover:bg-surface-app focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action-primary aria-selected:bg-action-primary/10 aria-selected:font-semibold aria-selected:text-action-primary"
              onClick={() => { onChange(option.id); closePicker(); }}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <span id={`${id}-error`} role="alert" className="text-sm text-rose-700">{error}</span> : null}
    </div>
  );
}
