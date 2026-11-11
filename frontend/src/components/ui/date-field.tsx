"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number(year) > 0 &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function DateField({
  name,
  label,
  defaultValue = "",
  error,
  onValueChange,
  picker = false,
  pickerIcon,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "defaultValue"> & {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  onValueChange?: (iso: string) => void;
  picker?: boolean;
  pickerIcon?: ReactNode;
}) {
  if (picker) {
    return (
      <DatePicker
        name={name}
        label={label}
        defaultValue={defaultValue}
        error={error}
        onValueChange={onValueChange}
        icon={pickerIcon}
      />
    );
  }
  return (
    <TextDate
      name={name}
      label={label}
      defaultValue={defaultValue}
      error={error}
      onValueChange={onValueChange}
      {...props}
    />
  );
}

function TextDate({
  name,
  label,
  defaultValue = "",
  error,
  onValueChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "defaultValue"> & {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  onValueChange?: (iso: string) => void;
}) {
  const id = useId();
  const [display, setDisplay] = useState(shown(defaultValue));
  const iso = parseDisplayDate(display);
  const invalid =
    error || (display && !iso ? "Nhập ngày theo định dạng dd/mm/yyyy." : "");
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-[#2b3544]">
      {label}
      <input
        {...props}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={display}
        onChange={(event) => {
          const next = event.target.value;
          setDisplay(next);
          onValueChange?.(parseDisplayDate(next) ?? "");
        }}
        aria-invalid={!!invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="min-h-12 w-full rounded-xl border border-[#c9d3e0] bg-white px-3.5 text-base font-normal text-[#1b2430]"
      />
      <input type="hidden" name={name} value={iso ?? ""} />
      {invalid ? (
        <span
          id={`${id}-error`}
          role="alert"
          className="text-sm text-[#9b2c2c]"
        >
          {invalid}
        </span>
      ) : null}
    </label>
  );
}

function DatePicker({
  name,
  label,
  defaultValue = "",
  error,
  onValueChange,
  icon,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  onValueChange?: (iso: string) => void;
  icon?: ReactNode;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState(shown(defaultValue));
  const iso = parseDisplayDate(display) ?? "";
  const selected = iso ? new Date(`${iso}T00:00:00Z`) : null;
  const start = selected ?? new Date();
  const [cursor, setCursor] = useState({
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
  });
  const [box, setBox] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(292, window.innerWidth - 16);
      const height = panelRef.current?.offsetHeight ?? 0;
      const top = rect.bottom + 8;
      setBox({
        top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      });
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    place();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function shift(delta: number) {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  function choose(day: number) {
    const month = String(cursor.month + 1).padStart(2, "0");
    const date = String(day).padStart(2, "0");
    const next = `${cursor.year}-${month}-${date}`;
    setDisplay(`${date}/${month}/${cursor.year}`);
    onValueChange?.(next);
    setOpen(false);
  }

  const cells = monthCells(cursor.year, cursor.month);
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-[#2b3544]">
      {label}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-border-default bg-surface-card px-4 text-left text-base font-normal focus:border-action-primary focus:ring-4 focus:ring-action-primary/15 focus:outline-none data-[invalid=true]:border-rose-400"
      >
        <span className={display ? "text-[#1b2430]" : "text-[#8b97a8]"}>
          {display || "dd/mm/yyyy"}
        </span>
        {icon}
      </button>
      <input type="hidden" name={name} value={iso} />
      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              className="fixed z-[90] max-h-[calc(100dvh-16px)] w-[292px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-2xl border border-[#e1e7ed] bg-white p-3 shadow-[0_16px_40px_rgba(9,18,22,0.16)]"
              style={{ top: box.top, left: box.left }}
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Tháng trước"
                  className="flex size-9 items-center justify-center rounded-lg text-[#254e7a] hover:bg-[#eaf1f7]"
                  onClick={() => shift(-1)}
                >
                  ‹
                </button>
                <p
                  role="status"
                  className="text-sm font-semibold text-[#091216]"
                >
                  {`Tháng ${cursor.month + 1} ${cursor.year}`}
                </p>
                <button
                  type="button"
                  aria-label="Tháng sau"
                  className="flex size-9 items-center justify-center rounded-lg text-[#254e7a] hover:bg-[#eaf1f7]"
                  onClick={() => shift(1)}
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-xs text-[#5b6676]">
                {weekdays.map((day) => (
                  <span key={day} className="py-1">
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, index) =>
                  day == null ? (
                    <span key={`empty-${index}`} />
                  ) : (
                    <button
                      key={day}
                      type="button"
                      aria-label={`${day} tháng ${cursor.month + 1} năm ${cursor.year}`}
                      aria-pressed={
                        selected?.getUTCFullYear() === cursor.year &&
                        selected.getUTCMonth() === cursor.month &&
                        selected.getUTCDate() === day
                      }
                      onClick={() => choose(day)}
                      className={`mx-auto flex size-9 items-center justify-center rounded-full text-sm ${
                        selected?.getUTCFullYear() === cursor.year &&
                        selected.getUTCMonth() === cursor.month &&
                        selected.getUTCDate() === day
                          ? "bg-[#3368a0] font-semibold text-white"
                          : "text-[#091216] hover:bg-[#eaf1f7]"
                      }`}
                    >
                      {day}
                    </button>
                  ),
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
      {error ? (
        <span
          id={`${id}-error`}
          role="alert"
          className="text-sm text-[#9b2c2c]"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

function shown(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("/")
    : value;
}

function monthCells(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
}
