# Listing reports and admin hide/restore — PRD

## Outcome

Authenticated users report harmful listings; admins investigate and independently suspend/restore public visibility.

## Scope and screens/actions

- Private report queue/detail/status/reason forms and APIs, abuse/rate limits and one live report per reporter/listing.
- Admin may inspect and hide a listing without waiting for a user report. Report count alone never automatically hides it.
- Reporter sees sanitized own outcome; investigation details and contacts remain private. Property reviews are P2 deferred, not an MVP implementation task.

## Functional requirements

### FR36 — Submit tenancy based review

**Priority:** P2 Defer. **Actors:** Tenant. **Delivery:** Deferred — no MVP implementation.

Optional one property review per ACTIVE/ENDED tenancy; rating1–5 and comment. Reviews pending manual moderation if enabled.

Acceptance: [3 cases for FR36](../../06-acceptance/test-scenarios.md#fr36); IDs FR36-AC01, FR36-AC02, FR36-AC03.

### FR37 — Display approved property reviews

**Priority:** P2 Defer. **Actors:** Guest; User. **Delivery:** Deferred — no MVP implementation.

Only display reviews when review feature exists; show approved reviews and consistent rating aggregate.

Acceptance: [2 cases for FR37](../../06-acceptance/test-scenarios.md#fr37); IDs FR37-AC01, FR37-AC02.

### FR38 — Report public listing

**Priority:** P0 Must. **Actors:** Authenticated user. **Delivery:** Primary: RNT-08.

Submit reason code and description for suspicious published listing. Save OPEN report synchronously; queue admin alert after commit. Do not use Kafka/RabbitMQ for report creation.

Acceptance: [5 cases for FR38](../../06-acceptance/test-scenarios.md#fr38); IDs FR38-AC01, FR38-AC02, FR38-AC03, FR38-AC04, FR38-AC05.

### FR39 — Investigate reports and suspend listings

**Priority:** P0 Must. **Actors:** Admin. **Delivery:** Primary: RNT-08.

Admin moves OPEN report to REVIEWING then RESOLVED/DISMISSED with required reason. An optional suspension is atomic with resolution and audit; notify reporter with sanitized outcome. Restoration is an explicit admin restriction action, not a new ordinary property/photo review.

Acceptance: [4 cases for FR39](../../06-acceptance/test-scenarios.md#fr39); IDs FR39-AC01, FR39-AC02, FR39-AC03, FR39-AC04.

### FR72 — Reporter outcome and rate limits

**Priority:** P0 Must. **Actors:** Authenticated reporter; Admin. **Delivery:** Primary: RNT-08.

Reporter can view own reports and sanitized status/outcome. Admin notes remain private. Enforce configured per-user/IP submission limits and one live report per reporter/listing.

Acceptance: [4 cases for FR72](../../06-acceptance/test-scenarios.md#fr72); IDs FR72-AC01, FR72-AC02, FR72-AC03, FR72-AC04.

### FR78 — Suspend and restore listings after reports or inspection

**Priority:** P0 Must. **Actors:** Admin. **Delivery:** Primary: RNT-08.

Admin can suspend published listing directly after inspection or authenticated report with reason, audit and notice. admin_suspended_at/by/reason independent of initial moderation/publication. Owner edits cannot remove suspension. Admin may explicitly restore after checking corrections; no repeated ordinary content approval process.

Acceptance: [5 cases for FR78](../../06-acceptance/test-scenarios.md#fr78); IDs FR78-AC01, FR78-AC02, FR78-AC03, FR78-AC04, FR78-AC05.

### FR79 — Moderate optional property reviews

**Priority:** P2 Defer. **Actors:** Admin. **Delivery:** Deferred — no MVP implementation.

If reviews are implemented, approve/reject exact submitted revision and allow reported harmful review removal. Required rejection/removal reasons.

Acceptance: [3 cases for FR79](../../06-acceptance/test-scenarios.md#fr79); IDs FR79-AC01, FR79-AC02, FR79-AC03.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
