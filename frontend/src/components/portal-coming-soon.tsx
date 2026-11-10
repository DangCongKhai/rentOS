import Link from "next/link";

interface PortalComingSoonProps {
  portalName: string;
  pageTitle: string;
  description?: string;
  backHref: string;
  backLabel: string;
}

export function PortalComingSoon({
  portalName,
  pageTitle,
  description = "Tính năng này đang được đội ngũ rentOS tích cực hoàn thiện và sẽ sớm ra mắt trong các phiên bản tiếp theo.",
  backHref,
  backLabel,
}: PortalComingSoonProps) {
  return (
    <div className="max-w-4xl mx-auto w-full py-8">
      <div className="mb-6">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          {portalName}
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {pageTitle}
        </h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center shadow-sm max-w-xl mx-auto">
        <div
          className="w-16 h-16 rounded-full bg-blue-50 text-[#3368a0] flex items-center justify-center text-2xl mb-4"
          aria-hidden="true"
        >
          🚀
        </div>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          Tính năng sắp ra mắt
        </span>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{pageTitle}</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          {description}
        </p>
        <Link
          href={backHref}
          className="inline-flex items-center justify-center min-h-[42px] px-6 py-2.5 rounded-lg bg-[#3368a0] hover:bg-[#285584] text-white text-xs font-semibold shadow-sm transition-colors"
        >
          &larr; {backLabel}
        </Link>
      </div>
    </div>
  );
}
