export type ReviewQueueItem = {
  id: string;
  title: string;
  owner: string;
  property: string;
  units: number;
  photos: number;
  submittedAt: string;
  waiting: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  initialApprovedAt: string | null;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi")
    .trim();
}

export function getReviewQueue(
  items: readonly ReviewQueueItem[],
  search = "",
): ReviewQueueItem[] {
  const keyword = normalizeSearch(search);

  return items
    .filter(
      (item) =>
        item.status === "PENDING" &&
        item.initialApprovedAt === null &&
        (normalizeSearch(item.title).includes(keyword) ||
          normalizeSearch(item.owner).includes(keyword)),
    )
    .sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() -
        new Date(b.submittedAt).getTime(),
    );
}
