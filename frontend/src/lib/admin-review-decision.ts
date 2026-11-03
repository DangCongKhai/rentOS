export type ReviewDecision = {
  listingId: string;
  status: "APPROVED" | "REJECTED";
  reason: string | null;
  reviewer: string;
  decidedAt: string;
  submittedVersion: number;
  published: false;
};

export type PreviewDecisions = Record<string, ReviewDecision>;

export type ReviewDecisionInput = {
  listingId: string;
  status: ReviewDecision["status"];
  reason?: string;
  reviewer: string;
  decidedAt: string;
  expectedVersion: number;
  currentVersion: number;
};

export class ReviewDecisionError extends Error {
  code: "reason" | "conflict" | "stale";

  constructor(code: "reason" | "conflict" | "stale", message: string) {
    super(message);
    this.code = code;
    this.name = "ReviewDecisionError";
  }
}

export function applyPreviewDecision(
  decisions: PreviewDecisions,
  input: ReviewDecisionInput,
): PreviewDecisions {
  if (decisions[input.listingId]) {
    throw new ReviewDecisionError("conflict", "Tin này đã có quyết định. Hãy đóng hộp thoại để xem kết quả mới nhất.");
  }
  if (input.expectedVersion !== input.currentVersion) {
    throw new ReviewDecisionError("stale", "Nội dung đã thay đổi. Vui lòng tải lại gói tin trước khi quyết định.");
  }
  const reason = input.reason?.trim() ?? "";
  if (input.status === "REJECTED" && (!reason || reason.length > 1000)) {
    throw new ReviewDecisionError("reason", "Vui lòng nhập lý do từ chối, tối đa 1.000 ký tự.");
  }
  return {
    ...decisions,
    [input.listingId]: {
      listingId: input.listingId,
      status: input.status,
      reason: input.status === "REJECTED" ? reason : null,
      reviewer: input.reviewer,
      decidedAt: input.decidedAt,
      submittedVersion: input.expectedVersion,
      published: false,
    },
  };
}

export function parsePreviewDecisions(raw: string | null): PreviewDecisions {
  if (raw === null) return {};
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid preview data");
  for (const [id, value] of Object.entries(data)) {
    if (!value || typeof value !== "object") throw new Error("Invalid preview decision");
    const record = value as Partial<ReviewDecision>;
    if (
      record.listingId !== id ||
      !["APPROVED", "REJECTED"].includes(record.status ?? "") ||
      typeof record.reviewer !== "string" || !record.reviewer.trim() ||
      typeof record.decidedAt !== "string" || !Number.isFinite(Date.parse(record.decidedAt)) ||
      !Number.isInteger(record.submittedVersion) || (record.submittedVersion ?? 0) < 1 ||
      record.published !== false ||
      (record.status === "APPROVED" && record.reason !== null) ||
      (record.status === "REJECTED" && (typeof record.reason !== "string" || !record.reason.trim() || record.reason.length > 1000))
    ) throw new Error("Invalid preview decision");
  }
  return data as PreviewDecisions;
}
