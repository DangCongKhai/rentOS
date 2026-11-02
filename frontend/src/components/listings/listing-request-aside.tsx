import { ownerInitials } from "./listing-format";

export function ListingRequestAside({
  ownerName,
  onRequest,
}: {
  ownerName: string;
  onRequest: () => void;
}) {
  const name = ownerName.trim() || "Chủ nhà";

  return (
    <aside className="rounded-2xl border border-[#d5dee7] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-full bg-[#dce7f3] text-lg font-bold text-[#254e7a]">
          {ownerInitials(name)}
        </div>
        <div>
          <p className="text-[13px] text-[#5b6676]">Chủ nhà</p>
          <p className="text-base font-bold text-[#091216]">{name}</p>
        </div>
      </div>
      <button
        type="button"
        className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#3368a0] px-4 text-base font-semibold text-white"
        onClick={onRequest}
      >
        Gửi yêu cầu thuê
      </button>
      <p className="mt-3 text-[13px] leading-5 text-[#5b6676]">Gửi yêu cầu không giữ chỗ. Chủ nhà sẽ liên lạc với bạn.</p>
    </aside>
  );
}
