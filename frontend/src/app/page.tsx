"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingCardView } from "@/features/discovery/listing-card";
import { ListingSearchForm } from "@/features/discovery/listing-search-form";
import { fetchListings, type ListingCard } from "@/features/discovery/listings-api";

const areas = [
  { name: "Hải Châu", detail: "Trung tâm, gần sông Hàn và chợ Hàn", image: "/images/discovery/area-a.png", query: "Hải Châu" },
  { name: "Sơn Trà", detail: "Gần biển Mỹ Khê, nhịp sống thư thả", image: "/images/discovery/area-b.png", query: "Sơn Trà" },
  { name: "Ngũ Hành Sơn", detail: "Yên tĩnh, gần biển Mỹ An và các trường đại học", image: "/images/discovery/area-c.png", query: "Ngũ Hành Sơn" },
];

const steps = [
  { number: "01", title: "Tìm và lọc theo ngày", body: "Lọc theo khu vực, giá, tiện ích. Tình trạng trống chỉ mang tính chỉ báo." },
  { number: "02", title: "Gửi yêu cầu thuê", body: "Gửi yêu cầu không giữ chỗ. Chủ nhà sẽ liên lạc cho bạn để trao đổi và hẹn xem nhà." },
  { number: "03", title: "Xác nhận hợp đồng", body: "Chủ nhà gửi phiên bản hợp đồng, bạn xem và xác nhận trước hạn chót." },
];

const reasons = [
  {
    title: "Nhà được xác thực",
    body: "Hạn chế thông tin sai lệch, giúp bạn tìm kiếm an tâm hơn.",
    icon: "/images/home/shield.svg",
    width: 14,
    height: 16,
  },
  {
    title: "Minh bạch chi phí",
    body: "Giá thuê, tiền cọc và các khoảng phí được công khai rõ ràng.",
    icon: "/images/home/list.svg",
    width: 22,
    height: 22,
  },
  {
    title: "Kết nối dễ dàng",
    body: "Liên hệ trực tiếp với chủ nhà và nhanh chóng giải đáp thắc mắc.",
    icon: "/images/home/chat.svg",
    width: 16,
    height: 15,
  },
  {
    title: "Nơi ở phù hợp",
    body: "Tìm không gian phù hợp với nhu cầu và phong cách sống của bạn.",
    icon: "/images/home/home.svg",
    width: 18,
    height: 18,
  },
];

const faqs = [
  { question: "Thời hạn thuê tối thiểu là bao lâu?", answer: "Tối thiểu 3 tháng. Mỗi căn có thể đặt thời hạn tối thiểu dài hơn, hiển thị rõ trên tin đăng." },
  { question: "Gửi yêu cầu có giữ chỗ cho tôi không?", answer: "Không. Gửi yêu cầu không giữ chỗ. Căn chỉ được giữ sau khi chủ nhà xác nhận." },
  { question: "Tôi có thanh toán qua rentOS không?", answer: "Tiền thuê và tiền cọc được thỏa thuận với chủ nhà. Tin đăng hiển thị mức giá và tiền cọc để bạn biết trước." },
  { question: "“Xác nhận” hợp đồng có phải chữ ký điện tử không?", answer: "Xác nhận trên rentOS ghi nhận bạn đã xem và đồng ý phiên bản hợp đồng. Đó không thay cho chữ ký công chứng." },
];

export default function Home() {
  const [listings, setListings] = useState<ListingCard[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchListings(new URLSearchParams(), controller.signal)
      .then((body) => {
        if (!controller.signal.aborted) setListings(body.data.slice(0, 3));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#cau-hoi") return;
    const section = document.getElementById("cau-hoi");
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - 91;
    window.scrollTo({ top });
  }, [listings]);

  return (
    <div className="bg-[#f0f4f7]">
      <section className="relative min-h-[720px] overflow-hidden bg-[#091216] text-white">
        <Image src="/images/discovery/hero.png" alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,18,22,0.33)_0%,rgba(9,18,22,0)_32%,rgba(9,18,22,0.13)_57%,rgba(9,18,22,0.79)_80%,rgb(9,18,22)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.05)_55%,rgba(0,0,0,0.15)_100%)]" />
        <div className="relative mx-auto grid min-h-[720px] max-w-[1280px] items-center gap-12 px-6 py-24 lg:grid-cols-[1fr_470px] lg:px-10">
          <div className="max-w-[520px]">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-[1.44px] text-[#8fbcd0]">
              <span className="h-0.5 w-7 bg-[#8fbcd0]" />
              THUÊ DÀI HẠN. TRỌN AN YÊN.
            </p>
            <h1 className="mt-4 text-5xl font-extrabold leading-[1.15] tracking-[-2px] sm:text-[56px] sm:leading-[64px]">
              Nơi để ở.
              <br />
              Chốn để thuộc về.
            </h1>
            <p className="mt-6 max-w-[460px] text-2xl leading-8 tracking-[-0.5px]">
              Nhà chọn lọc, hợp đồng rõ ràng.
              <br />
              Mở chương mới cùng RentOS.
            </p>
            <Link href="/listings" className="mt-8 inline-flex h-[60px] w-full max-w-[460px] items-center justify-between rounded-md bg-white px-6 text-xl font-semibold text-black">
              Tìm nhà ngay!
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <ListingSearchForm />
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-16 w-full max-w-[1100px] px-4">
        <div className="rounded-t-[25px] bg-white px-6 py-8 shadow-sm sm:px-12 lg:px-14">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[1.44px] text-[#66a3bf]">
            <span className="h-0.5 w-[30px] bg-[#66a3bf]" />
            Vì sao chọn chúng tôi
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
            <h2 className="text-[30px] font-semibold leading-[35px] tracking-[-1.2px] text-black">Tìm nhà dễ dàng. Sống an tâm.</h2>
            <p className="max-w-[490px] text-sm font-light leading-8 tracking-[-0.56px] text-[#181818]">
              Chúng tôi kết nối người tìm nhà với những không gian sống phù hợp, minh bạch và đáng tin cậy.
            </p>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {reasons.map((reason) => (
              <div key={reason.title} className="text-center">
                <span className="mx-auto flex size-[25px] items-center justify-center rounded-[3px] bg-[rgba(143,188,208,0.45)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reason.icon} alt="" width={reason.width} height={reason.height} />
                </span>
                <p className="mt-1 text-[15px] font-semibold tracking-[-0.6px] text-[#266683]">{reason.title}</p>
                <p className="mt-1 text-xs font-light leading-5 tracking-[-0.48px] text-black">{reason.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[url('/images/home/why-us.png')] rounded-b-[25px] bg-no-repeat bg-cover bg-center grid gap-6 bg-[#091216] px-6 py-8 text-white sm:grid-cols-3 sm:px-12">
          <Stat value="Nhà tốt. Người thật." label="Tin đăng được kiểm duyệt trước khi công khai" />
          <Stat value="12+" label="Khu phố đang có nhà" />
          <Stat value="4.8 / 5" label="Mức độ hài lòng" />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-6 px-6 py-20 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.96px] text-[#3368a0]">Bắt đầu xem nhà ngay</p>
            <h2 className="mt-2 text-4xl font-bold tracking-[-0.72px] text-[#3368a0]">Hãy tìm ngôi nhà dành cho chính bạn.</h2>
            <p className="mt-2 text-sm text-[#5b6676]">Bài đăng mới nhất</p>
          </div>
          <Link href="/listings" className="inline-flex min-h-11 items-center rounded-[15px] border border-[#b9c9dc] bg-white px-5 text-[15px] font-semibold text-[#254e7a]">
            Xem tất cả
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {listings.map((listing) => (
            <ListingCardView key={listing.id} listing={listing} href={`/listings/${listing.id}`} />
          ))}
        </div>
      </section>

      <section className="bg-[#091216] px-6 py-20 text-white">
        <div className="mx-auto grid max-w-[1200px] gap-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.96px] text-[#8fbcd0]">Trọn vẹn nơi bạn chọn</p>
            <h2 className="mt-2 text-4xl font-bold tracking-[-0.72px]">Đúng khu phố bạn thích. Đúng chất sống bạn yêu.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {areas.map((area) => (
              <Link key={area.name} href={`/listings?location=${encodeURIComponent(area.query)}`} className="relative block h-[340px] overflow-hidden rounded-2xl">
                <Image src={area.image} alt="" fill sizes="(min-width: 1024px) 380px, 100vw" className="object-cover" />
                <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#091216]/90 to-transparent" />
                <span className="absolute bottom-5 left-5 right-5">
                  <span className="block text-[26px] font-bold leading-8">{area.name}</span>
                  <span className="mt-1 block text-sm text-[#e4e9f0]">{area.detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-8 px-6 py-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.96px] text-[#3368a0]">Từ tìm kiếm đến an cư</p>
          <h2 className="mt-2 text-4xl font-bold tracking-[-0.72px] text-[#091216]">Bắt đầu hành trình mới chỉ với 3 bước.</h2>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="border-t-2 border-[#3368a0] pt-4">
              <p className="text-[32px] font-bold leading-none text-[#3368a0]">{step.number}</p>
              <h3 className="mt-2 text-lg font-semibold text-[#091216]">{step.title}</h3>
              <p className="mt-2 text-sm leading-5 text-[#454e5c]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid bg-[#3368a0] text-white lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-4 px-6 py-16 lg:px-24">
          <p className="text-xs font-semibold uppercase tracking-[0.96px] text-[#dce9f7]">Dành cho chủ nhà</p>
          <h2 className="max-w-lg text-4xl font-bold leading-[44px] tracking-[-0.72px]">Có phòng hoặc căn hộ cho thuê dài hạn?</h2>
          <p className="max-w-md text-base leading-6 text-[#e4edf7]">Đăng bất động sản, tạo hàng loạt căn, nhận yêu cầu và gửi đề xuất hợp đồng trong cùng một tài khoản.</p>
          <Link href="/owner" className="inline-flex min-h-11 w-fit items-center rounded-[15px] bg-white px-5 text-[15px] font-semibold text-[#091216]">
            Đăng tài sản cho thuê
          </Link>
        </div>
        <div className="relative h-[380px] lg:h-[460px]">
          <Image src="/images/discovery/owner-cta.png" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </section>

      <section className="bg-[#091216] px-6 py-24 text-white">
        <div className="mx-auto grid max-w-[1200px] gap-8">
          <p className="text-xs font-semibold tracking-[1.44px] text-[#8fbcd0]">NHỮNG NGƯỜI ĐÃ TÌM ĐƯỢC NƠI AN CƯ</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-3xl text-4xl font-bold tracking-[-1px]">Nơi ở tốt. Câu chuyện đẹp hơn.</h2>
            <p className="text-right text-xl font-semibold text-[#8fbcd0]">★★★★★ 4.8 / 5</p>
          </div>
          <blockquote className="max-w-xl rounded-[10px] bg-[#101f26] p-7 text-lg leading-relaxed">
            “Lần đầu tiên, căn nhà thực sự giống hệt như những gì được đăng tải. Chúng tôi biết rõ toàn bộ chi phí trước khi đăng ký và luôn có người hỗ trợ khi cần.”
            <footer className="mt-6 text-sm font-semibold">Maya & Daniel</footer>
          </blockquote>
        </div>
      </section>

      <section id="cau-hoi" className="mx-auto grid max-w-[1200px] scroll-mt-24 gap-10 px-6 py-20 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.96px] text-[#3368a0]">Một chút rõ ràng</p>
          <h2 className="mt-2 text-4xl font-bold tracking-[-0.72px] text-[#091216]">Trước khi bạn chuyển đến.</h2>
          <p className="mt-4 text-sm text-[#454e5c]">Những câu hỏi về cách rentOS hoạt động.</p>
        </div>
        <div>
          {faqs.map((item) => (
            <details key={item.question} className="border-b border-[#e1e7ed] py-4" open={item.question.startsWith("Thời hạn")}>
              <summary className="cursor-pointer text-base font-semibold text-[#091216]">{item.question}</summary>
              <p className="pt-3 text-sm leading-5 text-[#454e5c]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[13px] text-[#d5d5d5]">{label}</p>
    </div>
  );
}
