"use client";

type WizardProgressProps = {
  stages: string[];
  currentStep: number;
  onStepChange: (step: number) => void;
};

export function WizardProgress({
  stages,
  currentStep,
  onStepChange,
}: WizardProgressProps) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Các bước đăng ký
        </h2>
        <span className="text-xs text-slate-500">
          Bước {currentStep + 1} / {stages.length}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[#3368a0] transition-[width]"
          style={{ width: `${((currentStep + 1) / stages.length) * 100}%` }}
        />
      </div>
      <ol
        aria-label="Các bước tạo bất động sản"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"
      >
        {stages.map((stage, index) => (
          <li key={stage}>
            <button
              type="button"
              aria-label={stage}
              aria-current={currentStep === index ? "step" : undefined}
              onClick={() => onStepChange(index)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors sm:text-sm ${currentStep === index ? "border-[#3368a0] bg-blue-50 text-[#285584]" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${currentStep === index ? "bg-[#3368a0] text-white" : index < currentStep ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
              >
                {index < currentStep ? "✓" : index + 1}
              </span>
              <span>{stage}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="hidden text-xs leading-5 text-slate-500 lg:block">
        Bạn có thể lưu bản nháp và tiếp tục hoàn thiện bất cứ lúc nào.
      </p>
    </aside>
  );
}
