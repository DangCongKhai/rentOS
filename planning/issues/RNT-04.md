<!-- rentos-backlog-v2: RNT-04 -->

# RNT-04: Admin reviews and approves listings before first publication

## Outcome

Admins inspect the complete first listing package and approve or reject the exact submitted content safely.

## Ownership and order

- Phase 1.
- Implementation: **Tri** (frontend + backend + own tests).
- Reviewer: **Khai**.
- Prerequisites: [RNT-01](RNT-01.md), [RNT-03](RNT-03.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR13 — Review initial listing packages** (P0 Must): Admin queue displays only initial PENDING listings with property/unit details, selected gallery, policies and captured revisions. Show owner and completeness; admin approves or rejects with reason.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr13)
- **FR14 — Approve initial listing package** (P0 Must): Admin approves the exact submitted listing/property content revisions. Store reviewer/time and approved_content_revision. Approval permits publication but does not publish automatically.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr14)
- **FR15 — Reject initial listing with reason** (P0 Must): Admin rejects initial submission with a required reason. Owner corrects data and resubmits; later content violations use suspension rather than resetting initial approval.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr15)

## Backend deliverables

- [ ] Implement protected admin queue/detail and approve/reject endpoints using Hien’s authentication/Policies and Khai’s revision helpers. Return listing, property, units, selected photos and policies as one package.
- [ ] Lock and check expected listing/content revisions; require rejection reason; atomically persist review/audit/outbox outcomes. Seed pending/approved/rejected/stale examples independently of the owner UI.
- [ ] Maintain the Resource/FormRequest/OpenAPI contract and pagination/filter rules. Khai reviews privilege and locking decisions; Tri owns the implementation and tests.

## Frontend deliverables

- [ ] Build admin queue/filter/pagination, package detail, approval confirmation and required-reason rejection form.
- [ ] Cover keyboard access, loading/empty/error/403 states, 409 reload and 422 field feedback; integrate real local endpoints after fixture layout work.

## Acceptance criteria

- [ ] Admin can review a seeded complete package and commit approve or reject with a reason through the UI.
- [ ] A normal user cannot read the queue/detail or invoke the actions by calling the API directly.
- [ ] An owner content edit after submission makes the old admin decision fail with 409 and requires reloading current content.
- [ ] Duplicate or competing decisions cannot create contradictory transitions or duplicated audit/outbox results.
- [ ] No property-review queue, photo-review queue or changes-requested MVP state is introduced.
- [ ] UI sends the loaded revision, disables duplicate submission and handles server validation; fixture-only screenshots do not satisfy completion.

## Tests/evidence owned by this member

- [ ] Unit/component tests for required-reason forms, pagination and reload/error behavior.
- [ ] PostgreSQL/API integration tests for privilege, stale approval, duplicate decisions and transaction rollback.
- [ ] Manually check admin approval/rejection against seeded listing data; automate the action/authorization assertions at API level.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-04, NFR-07

NFR-02, NFR-03, NFR-04, NFR-07; T4a, T3g, T4d
Tri works both frontend and backend with Khai as reviewer. Owner listing submission/publication is RNT-06; Tri can finish against deterministic fixtures before that UI exists.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-04 is a planning key, not a GitHub number. Deleted issues are not reused.
