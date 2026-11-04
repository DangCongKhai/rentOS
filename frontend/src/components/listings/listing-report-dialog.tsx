"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/auth-api";
import { submitListingReport, type ReasonCode } from "@/lib/reports-api";

const reasons: Array<{ value: ReasonCode; title: string; detail: string }> = [
  {
    value: "FRAUD",
    title: "Gian lận hoặc lừa đảo",
    detail: "Yêu cầu chuyển tiền trước, giả danh chủ nhà",
  },
  {
    value: "MISLEADING",
    title: "Sai lệch thông tin",
    detail: "Ảnh, giá hoặc mô tả không đúng thực tế",
  },
  {
    value: "HARMFUL",
    title: "Nội dung độc hại",
    detail: "Phân biệt đối xử, xúc phạm hoặc bạo lực",
  },
  {
    value: "OTHER",
    title: "Khác",
    detail: "Lý do khác, vui lòng mô tả chi tiết",
  },
];

export function ListingReportDialog({
  listingId,
  listingTitle,
  isSignedIn = false,
  onClose,
}: {
  listingId: string;
  listingTitle: string;
  isSignedIn?: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReasonCode | "">("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!reason) {
      setError("Chọn lý do báo cáo.");
      return;
    }

    const description = String(new FormData(event.currentTarget).get("description") ?? "").trim();
    if (!description) {
      setError("Vui lòng nhập mô tả chi tiết nội dung vi phạm.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitListingReport(listingId, {
        reason_code: reason,
        description,
      });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Bạn cần đăng nhập để gửi báo cáo vi phạm.");
        } else if (err.status === 404) {
          setError("Tin đăng này hiện không còn khả dụng để tiếp nhận báo cáo.");
        } else if (err.status === 409) {
          setError("Bạn đã có một báo cáo đang được xử lý cho tin đăng này. Vui lòng chờ quản trị viên điều tra.");
        } else if (err.status === 429) {
          setError("Bạn đang thao tác quá nhanh. Vui lòng chờ 1 phút rồi thử lại.");
        } else {
          setError(err.message || "Có lỗi xảy ra khi gửi báo cáo.");
        }
      } else {
        setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[15px] bg-white p-7 shadow-[0_24px_30px_rgba(0,0,0,0.3)]"
        onClick={(event) => event.stopPropagation()}
      >
        {isSuccess ? (
          <div className="grid gap-5 text-center py-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#091216]">Đã tiếp nhận báo cáo</h2>
              <p className="mt-2 text-sm text-[#5b6676] max-w-[420px] mx-auto">
                Cảm ơn bạn đã đóng góp xây dựng môi trường thuê nhà an toàn và minh bạch. Quản trị viên rentOS sẽ sớm điều tra và xử lý.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Link
                href="/tenant/reports"
                className="inline-flex min-h-11 items-center justify-center rounded-[15px] bg-[#3368a0] px-5 text-[15px] font-semibold text-white hover:bg-[#254e7a]"
                onClick={onClose}
              >
                Xem báo cáo của tôi
              </Link>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-[15px] border border-[#b9c9dc] bg-white px-5 text-[15px] font-semibold text-[#254e7a] hover:bg-slate-50"
                onClick={onClose}
              >
                Đóng
              </button>
            </div>
          </div>
        ) : !isSignedIn ? (
          <div className="grid gap-5 text-center py-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#091216]">Yêu cầu đăng nhập</h2>
              <p className="mt-2 text-sm text-[#5b6676]">
                Bạn cần đăng nhập tài khoản rentOS để gửi báo cáo vi phạm tin đăng này.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                href={`/login?redirect=/listings/${listingId}`}
                className="inline-flex min-h-11 items-center justify-center rounded-[15px] bg-[#3368a0] px-6 text-[15px] font-semibold text-white hover:bg-[#254e7a]"
              >
                Đăng nhập ngay
              </Link>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-[15px] border border-[#b9c9dc] bg-white px-5 text-[15px] font-semibold text-[#254e7a] hover:bg-slate-50"
                onClick={onClose}
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="report-title" className="text-[22px] font-bold leading-[30px] tracking-[-0.22px] text-[#091216]">
                  Báo cáo tin đăng này
                </h2>
                <p className="text-sm leading-5 text-[#5b6676]">{listingTitle}</p>
              </div>
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-xl hover:bg-slate-100"
                aria-label="Đóng"
                onClick={onClose}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/listings/report-close.svg" alt="" width={22} height={22} />
              </button>
            </div>

            <fieldset className="grid gap-2">
              <legend className="pb-2 text-sm font-semibold leading-[21px] text-[#091216]">Lý do báo cáo</legend>
              {reasons.map((item) => {
                const selected = reason === item.value;
                return (
                  <label
                    key={item.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                      selected ? "border-[#3368a0] bg-[#f3f8fd]" : "border-[#dde3eb] bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={item.value}
                      checked={selected}
                      onChange={() => setReason(item.value)}
                      className="sr-only"
                    />
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-[10px] border-2 ${
                        selected ? "border-[#3368a0]" : "border-[#7a8799]"
                      }`}
                      aria-hidden="true"
                    >
                      <span className={`size-2.5 rounded-[5px] ${selected ? "bg-[#3368a0]" : ""}`} />
                    </span>
                    <span>
                      <span className="block text-[15px] font-bold leading-[22px] text-[#091216]">{item.title}</span>
                      <span className="block text-[13px] leading-5 text-[#5b6676]">{item.detail}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <label className="grid gap-1.5 text-sm font-semibold leading-[21px] text-[#2b3544]">
              Mô tả chi tiết vi phạm (bắt buộc)
              <textarea
                name="description"
                rows={3}
                placeholder="Cung cấp thêm chi tiết vi phạm để ban quản trị dễ dàng xác minh..."
                className="min-h-24 rounded-xl border border-[#c9d3e0] bg-white px-3.5 py-2.5 text-base font-normal leading-normal text-[#1b2430] placeholder:text-slate-400 focus:border-[#3368a0] focus:outline-none"
              />
            </label>

            <p className="flex items-start gap-3 rounded-[15px] border border-[#bfd3ea] bg-[#eef3f9] px-[18px] py-3.5 text-sm leading-5 text-[#1f3a5c]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/listings/report-info.svg" alt="" width={18} height={18} className="mt-0.5 shrink-0" />
              <span>Việc gửi báo cáo không tự động ẩn tin đăng. Ban quản trị sẽ nhanh chóng thẩm định và xử lý theo quy định.</span>
            </p>

            {error ? (
              <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-[15px] border border-[#b9c9dc] bg-white px-5 text-[15px] font-semibold leading-[21px] text-[#254e7a] hover:bg-slate-50"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-11 items-center justify-center rounded-[15px] bg-[#3368a0] px-5 text-[15px] font-semibold leading-[21px] text-white hover:bg-[#254e7a] disabled:opacity-50"
              >
                {isSubmitting ? "Đang gửi..." : "Gửi báo cáo"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
