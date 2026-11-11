import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

interface PortalEmptyStateProps {
  icon?: ReactNode;
  kicker?: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  onCtaClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  secondaryText?: string;
  secondaryHref?: string;
}

export function PortalEmptyState({
  icon = "🏠",
  kicker,
  title,
  description,
  ctaText,
  ctaHref,
  onCtaClick,
  secondaryText,
  secondaryHref,
}: PortalEmptyStateProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center shadow-sm max-w-2xl mx-auto w-full">
      <div
        className="w-16 h-16 rounded-full bg-blue-50 text-[#3368a0] flex items-center justify-center text-3xl mb-4"
        aria-hidden="true"
      >
        {icon}
      </div>
      {kicker && (
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          {kicker}
        </span>
      )}
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
        {title}
      </h2>
      <p className="max-w-md text-sm text-slate-600 leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-sm font-semibold shadow-sm transition-colors"
          href={ctaHref}
          onClick={onCtaClick}
        >
          {ctaText}
        </Link>
        {secondaryText && secondaryHref && (
          <Link
            className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors"
            href={secondaryHref}
          >
            {secondaryText}
          </Link>
        )}
      </div>
    </div>
  );
}
