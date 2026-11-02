import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  marketingPanel = false,
  wide = false,
  welcomeTitle,
  welcomeCopy,
  welcomeFooter,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  marketingPanel?: boolean;
  wide?: boolean;
  welcomeTitle?: string;
  welcomeCopy?: string;
  welcomeFooter?: string;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <section
        className={`w-full bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden ${
          marketingPanel
            ? "max-w-[960px] flex flex-col md:flex-row min-h-[610px]"
            : wide
            ? "max-w-4xl"
            : "max-w-md"
        }`}
        aria-labelledby="auth-title"
      >
        {marketingPanel && (
          <aside
            className="relative md:w-[450px] shrink-0 min-h-[320px] md:min-h-full p-8 sm:p-10 lg:p-12 flex flex-col justify-between text-white overflow-hidden bg-[#091216]"
            aria-label="Thông tin về rentOS"
          >
            {/* Background Hero Image */}
            <Image
              src="/images/auth-hero.png"
              alt="Không gian sống rentOS"
              fill
              priority
              sizes="(min-width: 768px) 450px, 100vw"
              className="object-cover object-center"
            />
            {/* Gradient Overlay for Readability */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#091216] via-[#091216]/65 to-[#091216]/40 pointer-events-none"
              aria-hidden="true"
            />

            {/* Top Brand Kicker */}
            <div className="relative z-10 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-200">
              <span aria-hidden="true">⌂</span> Nơi để ở. Chọn để thuộc về.
            </div>

            {/* Bottom Emotional Copy */}
            <div className="relative z-10 mt-auto pt-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3 leading-snug">
                {welcomeTitle}
              </h2>
              <p className="text-white/85 text-sm leading-relaxed mb-5">
                {welcomeCopy}
              </p>
              <div className="w-11 h-0.5 bg-[#75B0C6] mb-4" />
              <p className="text-xs text-[#BCD0DB] font-medium leading-relaxed">
                {welcomeFooter ?? "Bình yên bắt đầu từ một nơi gọi là nhà."}
              </p>
            </div>
          </aside>
        )}
        <div className={`p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white ${marketingPanel ? "flex-1 md:w-[508px]" : "flex-1"}`}>
          {eyebrow ? (
            <span className="block text-slate-400 text-[11px] font-bold tracking-wider uppercase mb-1.5">
              {eyebrow}
            </span>
          ) : null}
          <h1 id="auth-title" className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            {title}
          </h1>
          <p className="text-slate-600 text-sm mb-6">{description}</p>
          {children}
        </div>
      </section>
    </div>
  );
}

export function FormMessage({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <p
      className={`text-sm rounded-lg p-3 my-2 ${
        error
          ? "text-rose-700 bg-rose-50 border border-rose-200"
          : "text-emerald-700 bg-emerald-50 border border-emerald-200"
      }`}
      role="status"
    >
      {message}
    </p>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <span id={id} className="block text-xs text-rose-600 font-medium mt-1">
      {message}
    </span>
  ) : null;
}

