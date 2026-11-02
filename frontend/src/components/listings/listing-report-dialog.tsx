"use client";

import { useEffect, useState, type FormEvent } from "react";

const reasons = [
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
    detail: "Phân biệt đối xử, xúc phạm",
  },
  {
    value: "OTHER",
    title: "Khác",
    detail: "Lý do khác, vui lòng mô tả",
  },
] as const;

export function ListingReportDialog({
  listingTitle,
  onClose,
}: {
  listingTitle: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = String(new FormData(event.currentTarget).get("description") ?? "").trim();
    if (!reason) {
      setNotice("");
      setError("Chọn lý do báo cáo.");
      return;
    }
    if (!description) {
      setNotice("");
      setError("Nhập mô tả.");
      return;
    }
    setError("");
    setNotice("Chưa gửi báo cáo. Việc gửi tới quản trị viên sẽ được nối sau.");
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[15px] bg-white p-7 shadow-[0_24px_30px_rgba(0,0,0,0.3)]"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="report-title" className="text-[22px] font-bold leading-[30px] tracking-[-0.22px] text-[#091216]">
                Báo cáo tin đăng này
              </h2>
              <p className="text-sm leading-5 text-[#5b6676]">{listingTitle}</p>
            </div>
            <button type="button" className="flex size-11 items-center justify-center rounded-xl" aria-label="Đóng" onClick={onClose}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/listings/report-close.svg" alt="" width={22} height={22} />
            </button>
          </div>

          <fieldset className="grid gap-2">
            <legend className="pb-2 text-sm font-semibold leading-[21px] text-[#091216]">Lý do</legend>
            {reasons.map((item) => {
              const selected = reason === item.value;
              return (
                <label
                  key={item.value}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 ${selected ? "border-[#3368a0] bg-[#f3f8fd]" : "border-[#dde3eb] bg-white"}`}
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
                    className={`flex size-5 shrink-0 items-center justify-center rounded-[10px] border-2 ${selected ? "border-[#3368a0]" : "border-[#7a8799]"}`}
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
            Mô tả (bắt buộc)
            <textarea
              name="description"
              className="min-h-24 rounded-xl border border-[#c9d3e0] bg-white px-3.5 py-2.5 text-base font-normal leading-normal text-[#1b2430]"
            />
          </label>

          <p className="flex items-start gap-3 rounded-[15px] border border-[#bfd3ea] bg-[#eef3f9] px-[18px] py-3.5 text-sm leading-5 text-[#1f3a5c]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/listings/report-info.svg" alt="" width={18} height={18} className="mt-0.5" />
            Việc báo cáo không tự động ẩn bài đăng. Quản trị viên sẽ xem xét bài viết này.
          </p>

          {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
          {notice ? <p role="status" className="text-sm text-[#1f3a5c]">{notice}</p> : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-[15px] border border-[#b9c9dc] bg-white px-5 text-[15px] font-semibold leading-[21px] text-[#254e7a]"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-[15px] bg-[#3368a0] px-5 text-[15px] font-semibold leading-[21px] text-white"
            >
              Gửi báo cáo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
