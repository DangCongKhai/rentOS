import assert from "node:assert/strict";
import test from "node:test";
import { applyPreviewDecision, parsePreviewDecisions, ReviewDecisionError } from "./admin-review-decision.ts";
import { getReviewQueue } from "./admin-review-queue.ts";

const approval = {
  listingId: "listing-1", status: "APPROVED", reviewer: "Trần Minh",
  decidedAt: "2026-10-29T10:00:00Z", expectedVersion: 1, currentVersion: 1,
};

test("approval records reviewer and time without publishing the listing", () => {
  const result = applyPreviewDecision({}, approval)["listing-1"];
  assert.equal(result.status, "APPROVED");
  assert.equal(result.reviewer, "Trần Minh");
  assert.equal(result.decidedAt, approval.decidedAt);
  assert.equal(result.published, false);
  assert.equal(result.reason, null);
});

test("rejection requires a nonblank reason and preserves the pending state on failure", () => {
  const original = {};
  for (const reason of [undefined, "", "   ", "\n\t", "x".repeat(1001)]) {
    assert.throws(() => applyPreviewDecision(original, { ...approval, status: "REJECTED", reason }), (error) => error instanceof ReviewDecisionError && error.code === "reason");
  }
  assert.deepEqual(original, {});
});

test("valid rejection saves the trimmed reason and survives serialization", () => {
  const result = applyPreviewDecision({}, { ...approval, status: "REJECTED", reason: "  Cần sửa địa chỉ.  " });
  assert.equal(result["listing-1"].reason, "Cần sửa địa chỉ.");
  assert.equal(result["listing-1"].published, false);
  assert.deepEqual(parsePreviewDecisions(JSON.stringify(result)), result);
});

test("duplicate or opposite decisions cannot overwrite an existing outcome", () => {
  const first = applyPreviewDecision({}, approval);
  for (const status of ["APPROVED", "REJECTED"]) {
    assert.throws(() => applyPreviewDecision(first, { ...approval, status, reason: "Nội dung sai" }), (error) => error instanceof ReviewDecisionError && error.code === "conflict");
  }
  assert.equal(first["listing-1"].status, "APPROVED");
});

test("stale versions fail before a decision is created", () => {
  assert.throws(() => applyPreviewDecision({}, { ...approval, currentVersion: 2 }), (error) => error instanceof ReviewDecisionError && error.code === "stale");
});

test("saved decisions are removed from the pending queue", () => {
  const decisions = applyPreviewDecision({}, approval);
  const result = getReviewQueue([
    { id: "listing-1", title: "Tin đã duyệt", owner: "Linh", submittedAt: approval.decidedAt, initialApprovedAt: approval.decidedAt, status: decisions["listing-1"].status },
    { id: "listing-2", title: "Tin đang chờ", owner: "Hòa", submittedAt: approval.decidedAt, initialApprovedAt: null, status: "PENDING" },
  ]);
  assert.deepEqual(result.map((item) => item.id), ["listing-2"]);
});

test("invalid local records do not masquerade as valid review outcomes", () => {
  for (const raw of ["broken", "null", "[]", '{"listing-1":{}}']) {
    assert.throws(() => parsePreviewDecisions(raw));
  }
  const valid = applyPreviewDecision({}, approval);
  assert.throws(() => parsePreviewDecisions(JSON.stringify({ "listing-1": { ...valid["listing-1"], published: true } })));
  assert.deepEqual(parsePreviewDecisions(null), {});
});
