<!-- rentos-backlog-v2: RNT-05 -->

# RNT-05: Create tenancy proposals and confirm the same contract version

## Outcome

An owner turns a pending rental request into a reserved tenancy, and both parties manage the same immutable contract version through confirmation, correction and lifecycle actions.

## Ownership and order

- Phase 2.
- Implementation: **Kien** (frontend + backend + own tests).
- Reviewer: **Khai**.
- Prerequisites: [RNT-01](RNT-01.md), [RNT-06](RNT-06.md), [RNT-07](RNT-07.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR30 — Accept request when tenancy proposal commits** (P0 Must): Create tenancy, immutable ORIGINAL contract version, explicit owner confirmation, temporary reservation, audit and outbox; change rental request PENDING to ACCEPTED in the same transaction. Tenant confirmation follows separately.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr30)
- **FR33 — Enforce nonoverlapping unit rental periods** (P0 Must): PostgreSQL GiST exclusion constraint on tenancies(unit_id, daterange(blocked_start_date, blocked_end_date+1, [))) for PENDING_CONFIRMATION/CONFIRMED/ACTIVE. Different nonoverlapping future tenancies on one unit are permitted. Blocking envelope includes confirmed span plus any proposed renewal extension.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr33)
- **FR34 — Create tenancy proposal with temporary reservation** (P0 Must): Owner chooses exact READY nonarchived unit in request property, enters final dates/rent/deposit, negotiated policy snapshot and private agreement document, then explicitly confirms version. Create one continuing tenancy with version 1, pending pointer and configured confirmation deadline. Default reservation 48h is a proposed configurable setting.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr34)
- **FR35 — View tenancy timeline and contract versions** (P0 Must): Owner and tenant can view all immutable version metadata/documents, each party confirmation/decline, proposed/current/upcoming terms, deadline and supersession links. Derive state from current pending pointer, confirmations and audit events; do not mark old versions confirmed by inference.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr35)
- **FR42 — Rental request tenancy and renewal action APIs** (P0 Must): Provide authenticated request submit/withdraw/reject, tenancy propose/correct/cancel/end/move-in, exact-version confirm/decline and renewal request/propose actions. Shared actions enforce policies, idempotency and transaction rules. No viewings endpoints.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr42)
- **FR66 — Cancel proposals and end confirmed tenancies** (P0 Must): Initial proposal decline releases reservation and sets AWAITING_REVISION; owner may issue corrected version under same tenancy after rechecking availability. Expired initial proposal becomes EXPIRED. Owner may cancel pre-start confirmed tenancy or record actual end with reason; preserve accepted enquiry/history and immutable agreements. Ending cancels pending renewal work and releases only the remaining blocked portion.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr66)
- **FR67 — Record original immutable agreement version** (P0 Must): Store version_number, ORIGINAL type, dates/rent/deposit, negotiated policies, private unique document_path, SHA256, optional owner-reported signed_on and created_by/created_at. No signing service. Owner explicitly confirms exact version on submit; tenant must independently confirm same UUID/hash. Store owner_confirmed_at, tenant_confirmed_at, tenant_rejected_at and tenant_rejection_reason on tenancy_contracts; there is no separate confirmation entity.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr67)
- **FR71 — Keep immutable versions and effective agreement history** (P0 Must): tenancy_contracts stores immutable submitted agreement versions, agreed terms/document/hash and write-once participant confirmation metadata. ORIGINAL and consecutive RENEWAL segments represent agreed periods; corrections create new rows with supersedes_contract_id. Current agreed rent comes only from the mutually confirmed segment covering the date. No separate contract_confirmations table. Confirmed mid-term amendments remain deferred.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr71)
- **FR80 — Confirm move-in after mutual contract confirmation** (P0 Must): Owner records move-in on/after first confirmed start date for CONFIRMED tenancy, changes to ACTIVE and audits. PENDING_CONFIRMATION never activates on date arrival. Future nonoverlapping tenancies remain permitted; activation does not extend blocked range.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr80)
- **FR81 — Confirm the exact contract version mutually** (P0 Must): Both parties acknowledge the same tenancy_contracts.id and immutable document_sha256. owner_confirmed_at is set only through explicit owner submission; tenant_confirmed_at is set once by the related tenant before deadline on the current pending contract. Tenant may instead set tenant_rejected_at with reason, never both outcomes. The final confirmation promotes confirmed dates and clears the pending pointer/deadline atomically. A new contract version requires fresh confirmation fields.
  - [All 6 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr81)
- **FR82 — Decline and correct unconfirmed versions** (P0 Must): Tenant can decline exact current version with reason. Initial tenancy becomes AWAITING_REVISION and releases hold; renewal decline keeps confirmed tenancy/range and request PENDING. Owner creates corrected immutable version linked to superseded version, obtains new explicit owner confirmation and new reservation/deadline after rechecking availability. No correction of already mutually confirmed terms in MVP.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr82)
- **FR86 — Enforce immutable contract terms and write-once confirmations** (P0 Must): Database triggers protect tenancy_contracts terms/document/hash from update/delete while permitting one authorized null-to-value tenant confirmation or rejection update. Existing confirmation timestamps and reasons cannot be overwritten. Composite FKs keep pending/latest/superseded/basis contract references in the same tenancy. Deferred invariant checks enforce exact-contract mutual confirmation, request outcomes and date projections. No separate confirmation table.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr86)

## Backend deliverables

- [ ] Create original tenancy, immutable tenancy_contracts row, explicit owner acknowledgement, finite blocked interval and ACCEPTED rental request in one transaction. Enforce minimum original term of 3 calendar months, positive rent and nonnegative deposit; snapshot agreed policies.
- [ ] Privately stage/validate document, store immutable path/hash, authorize per-party download and verify current UUID/hash/revision/server deadline on tenant confirmation or rejection. Embedded confirmation metadata is write-once.
- [ ] Decline releases hold to AWAITING_REVISION; correction appends a fresh version and reacquires dates. Implement owner move-in, eligible cancellation and actual ending with history/audit preserved and common lock order.

## Frontend deliverables

- [ ] Build owner proposal/document form and tenant/owner tenancy dashboards with current terms, pending deadline, immutable version timeline and private document viewer.
- [ ] Build exact-version confirm/decline, correction, move-in/cancel/end controls with explicit acknowledgement, conflict recovery and clear proposed versus agreed terms.

## Acceptance criteria

- [ ] Proposal success commits contract, tenancy, hold and rental request acceptance together; overlap failure leaves the rental request PENDING and no partial proposal.
- [ ] Pending rental requests have no standalone Accept action; pending-confirmation tenancies reserve dates and adjacent bookings still work.
- [ ] Only the correct tenant can confirm/decline the exact current UUID/hash before deadline; competing decisions and stale versions cannot overwrite history.
- [ ] Same retry key/payload replays original success; a new attempt to create another original proposal for an accepted rental request returns a conflict.
- [ ] Correction creates a new immutable row with fresh confirmations; existing agreed terms/documents remain unchanged.
- [ ] Move-in requires mutual confirmation and the relevant start condition; an agreed end date does not automatically prove physical move-out.
- [ ] Private documents, contacts and hashes/links are only disclosed through the authorized participant contract, with no secret payload in public caches/logs.

## Tests/evidence owned by this member

- [ ] Unit tests for agreed-term/date/version/state validation and full frontend form/action states.
- [ ] Independent PostgreSQL transaction tests for overlap/adjacency, rollback, confirm-versus-decline/cancel and correction reacquisition.
- [ ] API integration tests for owner proposal and tenant decline/correct/confirm/lifecycle actions, plus manual checks of changed forms. Use real PostgreSQL for exclusion constraints.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-04, NFR-07

NFR-02, NFR-03, NFR-04, NFR-07; T4a, T3g, T4d
Use tenancy_contracts only; no contract_versions or contract_confirmations tables. Shared database/revision helpers belong to RNT-01; authentication middleware belongs to RNT-03; original/renewal scheduled expiry is finalized in RNT-09.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-05 is a planning key, not a GitHub number. Deleted issues are not reused.
