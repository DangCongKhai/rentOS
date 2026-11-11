<!-- rentos-backlog-v2: RNT-16 -->

# RNT-16: Verify admin approval/report permissions and prepare reproducible setup/demo evidence

## Outcome

Admin workflows are secure and accessible, and the marker/team can reproduce the application and inspect genuine implementation evidence.

## Ownership and order

- Phase 4.
- Implementation: **Tri** (frontend + backend + own tests).
- Reviewer: **Hien**.
- Prerequisites: [RNT-04](RNT-04.md), [RNT-08](RNT-08.md), [RNT-12](RNT-12.md), [RNT-13](RNT-13.md), [RNT-14](RNT-14.md), [RNT-15](RNT-15.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR13 — Review initial listing packages** (P0 Must): Admin queue displays only initial PENDING listings with property/unit details, selected gallery, policies and captured revisions. Show owner and completeness; admin approves or rejects with reason.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr13)
- **FR14 — Approve initial listing package** (P0 Must): Admin approves the exact submitted listing/property content revisions. Store reviewer/time and approved_content_revision. Approval permits publication but does not publish automatically.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr14)
- **FR15 — Reject initial listing with reason** (P0 Must): Admin rejects initial submission with a required reason. Owner corrects data and resubmits; later content violations use suspension rather than resetting initial approval.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr15)
- **FR38 — Report public listing** (P0 Must): Submit reason code and description for suspicious published listing. Save OPEN report synchronously; queue admin alert after commit. Do not use Kafka/RabbitMQ for report creation.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr38)
- **FR39 — Investigate reports and suspend listings** (P0 Must): Admin moves OPEN report to REVIEWING then RESOLVED/DISMISSED with required reason. An optional suspension is atomic with resolution and audit; notify reporter with sanitized outcome. Restoration is an explicit admin restriction action, not a new ordinary property/photo review.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr39)
- **FR47 — Structured logs and critical alerts** (P1 Should): Log request/event ID, actor/resource UUIDs, operation and failure duration/context. Alert configured admin/developer on critical storage, transaction or exhausted job failures. Business audit remains separate.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr47)
- **FR48 — Development monitoring and slow query alerts** (P1 Should): Use Telescope in development with restricted access. Capture slow query duration and cumulative query time and configure explicit developer alert thresholds; Telescope display alone is not an alert.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr48)
- **FR72 — Reporter outcome and rate limits** (P0 Must): Reporter can view own reports and sanitized status/outcome. Admin notes remain private. Enforce configured per-user/IP submission limits and one live report per reporter/listing.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr72)
- **FR78 — Suspend and restore listings after reports or inspection** (P0 Must): Admin can suspend published listing directly after inspection or authenticated report with reason, audit and notice. admin_suspended_at/by/reason independent of initial moderation/publication. Owner edits cannot remove suspension. Admin may explicitly restore after checking corrections; no repeated ordinary content approval process.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr78)

## Backend deliverables

- [ ] Fix discovered moderation/report validation, authorization, stale-decision and privacy defects; keep reviewed transitions/audit consistent with owner/public eligibility.
- [ ] Finish root README covering actual tools/setup, env names, schema/migration/seed/worker/scheduler, ERD, API types/docs, tests, monitoring and lecturer evidence.
- [ ] Collect evidence links from all four members and verify each member’s own five sprint self-reports. Document deadline/penalty policy rather than creating fake contribution records.

## Frontend deliverables

- [ ] Repair admin queue/detail/forms across keyboard/mobile and server failure states, integrating actual endpoints rather than fixture-only demos.
- [ ] Capture actual sanitized screens and assemble <=10-minute >=720p MP4 demo with each member’s real feature/test contributions and accessible public/unlisted link.

## Acceptance criteria

- [ ] Admin UI and direct API calls pass normal-user denial, stale revision, reason validation and reporter privacy regressions.
- [ ] Keyboard focus/labels, loading/empty/error/retry states and pagination work on implemented review/report screens.
- [ ] A clean-machine setup rehearsal follows the README successfully, with resolving ERD/docs/type/test links and no secret values.
- [ ] The video meets duration/quality/access rules and shows implemented workflows plus real tests/alerts/performance evidence.
- [ ] Each of four members provides five truthful sprint reports; D checks links/completeness but does not write or claim others’ contributions.
- [ ] Submission and known limitations match actual code/test/evidence state, including any unresolved printed-rubric substitutions.
- [ ] Final demonstration includes a CSRF-protected browser form (valid and rejected submission), token settings create/revoke and cookie-free scoped-token allowed/denied/401 examples; all claims link to actual implementation evidence.

## Tests/evidence owned by this member

- [ ] Focused unit/component tests for final admin/accessibility defects.
- [ ] Backend moderation/privacy integration and real admin-to-public visibility API/component regression tests and manual UI checks.
- [ ] Clean setup rehearsal, link/access verification and actual demo/individual report checklist.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-04, NFR-05, NFR-06, NFR-07

NFR-02, NFR-03, NFR-04, NFR-05, NFR-06, NFR-07; T1a, T3g, T4d
Admin backend remains D-owned with Khai reviewing risky changes. Evidence work does not replace backend/frontend implementation or its tests.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-16 is a planning key, not a GitHub number. Deleted issues are not reused.
