const DEFAULT_MESSAGE = "Đang lục cả thế giới cho bạn...";

export function LoadingScreen({
  message = DEFAULT_MESSAGE,
  className = "min-h-[calc(100vh-75px)]",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center px-6 ${className}`} role="status">
      <p className="flex items-center gap-3 text-sm text-[#454e5c]">
        <span
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-[#d5dee7] border-t-[#3368a0]"
          aria-hidden="true"
        />
        {message}
      </p>
    </div>
  );
}
