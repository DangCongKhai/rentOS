import assert from "node:assert/strict";
import test from "node:test";
import { getReviewQueue } from "./admin-review-queue.ts";

const pending = {
  id: "first",
  title: "Studio gần biển Mỹ Khê",
  owner: "Hòa",
  property: "Nhà trọ",
  units: 1,
  photos: 2,
  submittedAt: "2026-10-19T04:20:00+07:00",
  waiting: "18 giờ",
  status: "PENDING",
  initialApprovedAt: null,
};

test("only pending packages without prior initial approval enter the queue", () => {
  const items = [
    pending,
    { ...pending, id: "approved", status: "APPROVED" },
    { ...pending, id: "rejected", status: "REJECTED" },
    { ...pending, id: "already-reviewed", initialApprovedAt: "2026-10-18T00:00:00Z" },
  ];
  assert.deepEqual(getReviewQueue(items).map((item) => item.id), ["first"]);
});

test("search supports accents, case and extra surrounding spaces", () => {
  assert.equal(getReviewQueue([pending], "  MY KHE  ").length, 1);
  assert.equal(getReviewQueue([pending], "Mỹ Khê").length, 1);
  assert.equal(getReviewQueue([pending], "HOA").length, 1);
});

test("search matches Vietnamese đ in titles and owner names", () => {
  assert.equal(getReviewQueue([{ ...pending, title: "Gần ĐH Bách khoa" }], "dh bach khoa").length, 1);
  assert.equal(getReviewQueue([{ ...pending, owner: "Đức" }], "duc").length, 1);
});

test("search uses title or owner, not private or unrelated fields", () => {
  assert.equal(getReviewQueue([pending], "xyz123").length, 0);
  assert.equal(getReviewQueue([pending], "Nhà trọ").length, 0);
  assert.equal(getReviewQueue([pending], "   ").length, 1);
});

test("queue sorts oldest first without mutating the input", () => {
  const older = { ...pending, id: "older", submittedAt: "2026-10-18T16:20:00+07:00" };
  const items = [pending, older];
  assert.deepEqual(getReviewQueue(items).map((item) => item.id), ["older", "first"]);
  assert.deepEqual(items.map((item) => item.id), ["first", "older"]);
});

test("an empty queue returns no rows", () => {
  assert.deepEqual(getReviewQueue([]), []);
});
