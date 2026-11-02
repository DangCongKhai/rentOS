"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Step = { title: string; body: string };

type Chapter = {
  title: string;
  duration: string;
  seconds: number;
  image: string;
  action: { href: string; label: string };
  steps: Step[];
};

const chapters: Chapter[] = [
  {
    title: "Tìm nhà phù hợp",
    duration: "02:40",
    seconds: 160,
    image: "/images/guide/chapter-1.png",
    action: { href: "/listings", label: "Bắt đầu tìm nhà" },
    steps: [
      { title: "Nhập khu vực hoặc từ khóa", body: "Ví dụ Sơn Trà, Mỹ An hoặc “studio gần biển”." },
      { title: "Chọn ngày thuê", body: "Kết quả hiển thị số căn còn trống cho đúng khoảng ngày bạn chọn, chỉ mang tính chỉ báo." },
      { title: "Thu hẹp bằng Bộ lọc", body: "Giá, loại căn, phòng ngủ, tiện ích và chính sách thú cưng." },
      { title: "Lưu vào Yêu thích", body: "Bấm biểu tượng trái tim để lưu tin và so sánh sau." },
    ],
  },
  {
    title: "Gửi yêu cầu thuê",
    duration: "03:15",
    seconds: 195,
    image: "/images/guide/chapter-2.png",
    action: { href: "/listings", label: "Xem tin đang trống" },
    steps: [
      { title: "Chọn căn ưu tiên", body: "Mở tin đăng và chọn căn bạn muốn chủ nhà liên lạc để trao đổi." },
      { title: "Gửi yêu cầu thuê", body: "Điền tên, số điện thoại và lời nhắn. Gửi yêu cầu không giữ chỗ." },
      { title: "Chờ chủ nhà liên lạc", body: "Chủ nhà gọi qua số bạn cung cấp để hẹn xem nhà." },
      { title: "Theo dõi yêu cầu", body: "Sau khi đăng nhập, xem lại yêu cầu trong Cổng cư dân." },
    ],
  },
  {
    title: "Quản lý hợp đồng",
    duration: "04:05",
    seconds: 245,
    image: "/images/guide/chapter-3.png",
    action: { href: "/tenant", label: "Mở cổng cư dân" },
    steps: [
      { title: "Nhận phiên bản hợp đồng", body: "Chủ nhà gửi một phiên bản để bạn xem trước hạn chót." },
      { title: "Đọc điều khoản đã lưu", body: "Giá, tiền cọc và nội quy trong hợp đồng có thể khác với tin đăng." },
      { title: "Xác nhận trước hạn chót", body: "Xác nhận ghi nhận bạn đã xem phiên bản đó. Đây không phải chữ ký công chứng." },
      { title: "Theo dõi trong cổng", body: "Hợp đồng đã xác nhận nằm trong Cổng cư dân của tài khoản bạn." },
    ],
  },
];

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function GuideScreen() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const chapter = chapters[index];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + 1 >= chapter.seconds) {
          setPlaying(false);
          return chapter.seconds;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, chapter.seconds]);

  function openChapter(next: number) {
    setIndex(next);
    setPlaying(false);
    setElapsed(0);
  }

  return (
    <div className="bg-white">
      <section className="bg-[#091216] px-6 pb-28 pt-14 text-white lg:px-10">
        <div className="mx-auto grid max-w-[1200px] gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.96px] text-[#8fbcd0]">Hướng dẫn</p>
          <h1 className="text-4xl font-bold tracking-[-0.8px] sm:text-[40px] sm:leading-[50px]">Thuê nhà trên rentOS trong 3 bước</h1>
          <p className="max-w-[620px] text-[17px] leading-[26px] text-[#c9d3e0]">
            Xem video ngắn về cách tìm nhà, gửi yêu cầu thuê và quản lý hợp đồng. Chọn từng chương để xem các bước chi tiết.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1200px] gap-6 px-6 pb-20 lg:-mt-20 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:px-10">
        <div className="grid gap-5">
          <div className="relative h-[280px] overflow-hidden rounded-[20px] bg-[#091216] shadow-[0_24px_60px_rgba(9,18,22,0.25)] sm:h-[441px]">
            <Image
              src={chapter.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 760px, 100vw"
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,18,22,0.85)] via-[rgba(9,18,22,0.1)] to-transparent" />
            <div className="absolute left-6 top-5 flex gap-2">
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[13px] font-semibold text-[#091216]">
                Chương {index + 1} / {chapters.length}
              </span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[13px] font-semibold text-[#091216]">{chapter.duration}</span>
            </div>
            <button
              type="button"
              className="absolute left-1/2 top-1/2 flex size-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_12px_15px_rgba(0,0,0,0.35)]"
              aria-label={`${playing ? "Tạm dừng" : "Phát"} video ${chapter.title}`}
              onClick={() => setPlaying((current) => !current)}
            >
              {playing ? (
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-6 w-1.5 rounded-sm bg-[#3368a0]" />
                  <span className="h-6 w-1.5 rounded-sm bg-[#3368a0]" />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/images/guide/play.svg" alt="" width={34} height={34} />
              )}
            </button>
            <div className="absolute inset-x-6 bottom-6 grid gap-2.5">
              <p className="text-2xl font-bold">{chapter.title}</p>
              <div className="flex items-center gap-3.5">
                <span className="relative h-[5px] flex-1 rounded-[3px] bg-white">
                  <span
                    className="absolute inset-y-0 left-0 rounded-[3px] bg-[#8fbcd0]"
                    style={{ width: `${(elapsed / chapter.seconds) * 100}%` }}
                  />
                </span>
                <span className="text-[13px]">{clock(elapsed)} / {chapter.duration}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[13px] font-semibold text-[#091216]">Phụ đề VI</span>
              </div>
            </div>
          </div>

          <section className="grid gap-3.5 rounded-[15px] border border-[#e1e7ed] bg-white p-6">
            <h2 className="text-lg font-semibold text-[#091216]">Các bước trong chương này</h2>
            {chapter.steps.map((step, stepIndex) => (
              <div key={step.title} className="flex gap-3.5">
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[15px] bg-[#eaf1f7] text-sm font-bold text-[#3368a0]">
                  {stepIndex + 1}
                </span>
                <p>
                  <span className="block text-base font-semibold leading-6 text-[#091216]">{step.title}</span>
                  <span className="block text-sm leading-5 text-[#454e5c]">{step.body}</span>
                </p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2.5 border-t border-[#e7ebf1] pt-3.5">
              <Link href={chapter.action.href} className="inline-flex min-h-11 items-center rounded-[15px] bg-[#3368a0] px-5 text-[15px] font-semibold text-white">
                {chapter.action.label}
              </Link>
              {index < chapters.length - 1 ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[15px] border border-[#b9c9dc] bg-white px-5 text-[15px] font-semibold text-[#254e7a]"
                  onClick={() => openChapter(index + 1)}
                >
                  Chương tiếp theo
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/guide/next.svg" alt="" width={14} height={14} />
                </button>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-3">
          <section className="grid gap-2.5 rounded-[15px] border border-[#e1e7ed] bg-white p-[18px]">
            <h2 className="text-lg font-semibold text-[#091216]">Danh sách video</h2>
            {chapters.map((item, itemIndex) => {
              const selected = itemIndex === index;
              return (
                <button
                  key={item.title}
                  type="button"
                  aria-pressed={selected}
                  className={`flex items-center gap-3 rounded-[14px] border p-2.5 text-left ${selected ? "border-[#3368a0] bg-[#f3f8fd]" : "border-[#e1e7ed] bg-white"}`}
                  onClick={() => openChapter(itemIndex)}
                >
                  <span className="relative h-[60px] w-24 shrink-0 overflow-hidden rounded-[10px] bg-[#091216]">
                    <Image src={item.image} alt="" fill sizes="96px" className="object-cover opacity-75" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/guide/play-small.svg" alt="" width={18} height={18} className="absolute top-[21px] left-[39px] z-10" />
                  </span>
                  <span>
                    <span className="block text-[13px] leading-5 text-[#5b6676]">Chương {itemIndex + 1} · {item.duration}</span>
                    <span className="block text-[15px] font-semibold text-[#091216]">{item.title}</span>
                    <span className="block text-[13px] leading-5 text-[#5b6676]">{selected ? "Đang chọn" : "Chưa xem"}</span>
                  </span>
                </button>
              );
            })}
          </section>
          <section className="grid gap-2.5 rounded-[15px] border border-[#e1e7ed] bg-[#f7fafc] p-[18px]">
            <h2 className="text-lg font-semibold text-[#091216]">Còn thắc mắc?</h2>
            <p className="text-sm leading-5 text-[#454e5c]">
              Xem câu trả lời cho những câu hỏi thường gặp về thời hạn thuê, giữ chỗ và xác nhận hợp đồng.
            </p>
            <Link href="/#cau-hoi" className="inline-flex min-h-11 items-center justify-center rounded-[15px] border border-[#b9c9dc] bg-white px-5 text-[15px] font-semibold text-[#254e7a]">
              Xem FAQ
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
