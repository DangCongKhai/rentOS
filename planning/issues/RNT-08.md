<!-- rentos-backlog-v2: RNT-08 -->

# RNT-08: Report listings and let admins investigate, hide or restore them

## Outcome

Authenticated users report listings, and admins investigate and hide harmful content using reasoned, audited decisions.

## Ownership and order

- Phase 2.
- Implementation: **Hien** (frontend + backend + own tests).
- Reviewer: **Khai**.
- Prerequisites: [RNT-01](RNT-01.md), [RNT-04](RNT-04.md), [RNT-06](RNT-06.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR38 — Report public listing** (P0 Must): Submit reason code and description for suspicious published listing. Save OPEN report synchronously; queue admin alert after commit. Do not use Kafka/RabbitMQ for report creation.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr38)
- **FR39 — Investigate reports and suspend listings** (P0 Must): Admin moves OPEN report to REVIEWING then RESOLVED/DISMISSED with required reason. An optional suspension is atomic with resolution and audit; notify reporter with sanitized outcome. Restoration is an explicit admin restriction action, not a new ordinary property/photo review.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr39)
- **FR72 — Reporter outcome and rate limits** (P0 Must): Reporter can view own reports and sanitized status/outcome. Admin notes remain private. Enforce configured per-user/IP submission limits and one live report per reporter/listing.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr72)
- **FR78 — Suspend and restore listings after reports or inspection** (P0 Must): Admin can suspend published listing directly after inspection or authenticated report with reason, audit and notice. admin_suspended_at/by/reason independent of initial moderation/publication. Owner edits cannot remove suspension. Admin may explicitly restore after checking corrections; no repeated ordinary content approval process.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr78)

## Backend deliverables

- [ ] Implement reporter submit/own outcomes, required category/reason, throttling and unique live report; reporter can see only sanitized own outcomes.
- [ ] Implement admin report queue/detail/OPEN-REVIEWING-RESOLVED-DISMISSED actions and separate suspend/restore actions with protected Policies, expected revisions, reason/audit/outbox and public-cache invalidation hooks.
- [ ] Keep suspension independent of first approval and owner publication; no automatic takedown based only on report count. Coordinate state changes through shared locking/actions.

## Frontend deliverables

- [ ] Build report modal and reporter list, admin investigation/filter/detail and reasoned resolve/dismiss/suspend/restore forms.
- [ ] Show status/reason appropriately for reporter versus admin; preserve entered text on failures and handle 403/409/422/429, loading/empty/retry and keyboard focus.

## Acceptance criteria

- [ ] Guest and forged reporter/admin requests fail; duplicate live reports and rate-limit cases have clear feedback.
- [ ] Only admins inspect private investigation detail and perform decisions; reporter sees only their own sanitized outcome.
- [ ] Admin suspension removes public eligibility immediately across routes; owner edits cannot restore visibility.
- [ ] Restore clears the admin restriction explicitly but does not republish owner-hidden content.
- [ ] Competing/stale decisions commit one consistent outcome and audit/outbox; reason is required for rejection/suspension and terminal decisions.
- [ ] No image-status moderation, property-review queue or report-count-only takedown is introduced.

## Tests/evidence owned by this member

- [ ] Unit/component tests for all report/reason forms, pagination, status rendering and failure states.
- [ ] PostgreSQL/API tests for privacy, rate limit, unique live report, stale decisions and owner-edit versus suspension race.
- [ ] API integration tests for report/investigate/suspend/restore and public visibility; manually check reporter/admin forms and status feedback.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-04, NFR-07

NFR-02, NFR-03, NFR-04, NFR-07; T3c, T4a, T3g, T4d
Tri owns both layers and writes all relevant tests; Khai reviews privilege and transaction rules. Do not split admin backend into another member’s implementation issue.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-08 is a planning key, not a GitHub number. Deleted issues are not reused.
