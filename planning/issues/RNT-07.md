<!-- rentos-backlog-v2: RNT-07 -->

# RNT-07: Submit/manage rental requests and save favourite properties

## Outcome

A tenant saves properties and submits a pending rental request; owners discuss offline and manage the rental-request list without premature acceptance.

## Ownership and order

- Phase 2.
- Implementation: **Tri** (frontend + backend + own tests).
- Reviewer: **Khai**.
- Prerequisites: [RNT-01](RNT-01.md), [RNT-03](RNT-03.md), [RNT-06](RNT-06.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR25 — Submit rental request with contact details** (P0 Must): Authenticated tenant submits contact_name, contact_phone, desired_move_in_date, desired_end_date, optional preferred_unit_id and message. Store contact snapshots. Status PENDING throughout offline discussion. No calendar, manual discussion acceptance or unit reservation at enquiry creation.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr25)
- **FR26 — Prevent duplicate pending rental requests** (P0 Must): At most one PENDING request per tenant/listing; accepted/rejected/withdrawn history remains. Unique partial index is authoritative; retries compare payload.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr26)
- **FR27 — Tenant rental request dashboard** (P0 Must): Display private submitted contacts, desired dates, request status/outcome and linked tenancy confirmation state. ACCEPTED means proposal created, not that tenancy contract is mutually confirmed.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr27)
- **FR28 — Withdraw pending rental request** (P0 Must): Tenant may withdraw own PENDING request with audit and owner notification. Accepted requests are handled through tenancy proposal actions instead.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr28)
- **FR29 — Owner rental request inbox** (P0 Must): Owner sees own property requests and private tenant contact snapshots, dates and preferred unit. Discuss offline while PENDING. Actions are Reject and Create tenancy proposal; no viewing/calendar or stand-alone Accept.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr29)
- **FR31 — Reject pending rental request** (P0 Must): Owner can reject PENDING enquiry with reason; no viewing cancellation or automatic rejection merely because another enquiry was accepted. System auto-rejection uses FR85.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr31)
- **FR32 — Audit request and tenancy outcomes** (P0 Must): Append-only audit events record request status, proposal/confirmation/version changes and automatic decisions with actor/system identity, safe before/after, reason and correlation UUID.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr32)
- **FR88 — Save and manage favourite properties** (P0 Must): Private authenticated property-level persistent saves, idempotent intended-state writes, safe hidden placeholders and private list/count. Saving creates no rental request/reservation.
  - [All 10 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr88)

## Backend deliverables

- [ ] Implement authenticated rental request submit/own list/withdraw and owner rental-request list/reject with contact snapshots, complete desired start/end, same-property preferred-unit scope, one pending tenant/listing request, reasons and audit.
- [ ] Keep requests PENDING throughout offline discussion; only RNT-05 proposal transaction marks ACCEPTED. Rental requests and favourites allocate no properties and units.
- [ ] Implement private favourite_properties PUT/DELETE/list/count/ids with actor from the Sanctum-authenticated profile, unique user/property pair, first-save 201/repeat 200 and repeated DELETE 204; unavailable targets return safe generic placeholders and remain removable.

## Frontend deliverables

- [ ] Build rental request form, tenant request dashboard, owner rental-request list and reject/withdraw controls with reason/conflict feedback.
- [ ] Build persistent property hearts, private badge and paginated saved list; guest login prompt without queued save; serialize per-property intended-state writes and reconcile failures/account switches.

## Acceptance criteria

- [ ] A valid rental request stores private contact snapshots and full interval, remains PENDING and does not reserve the preferred unit.
- [ ] Duplicate submit, stale withdrawal/reject and foreign-user contact access are rejected consistently; owner discussion never requires clicking Accept.
- [ ] Heart state survives reload, one user/property relation exists under repeated/concurrent saves and intended DELETE is idempotent even when the target becomes hidden.
- [ ] Hidden/suspended/archived saved targets disclose no title/photo/address/moderation reason; date unavailability alone does not delete the save.
- [ ] Out-of-order/network responses and account switches cannot show stale hearts or another user’s private list.
- [ ] Request status and private count/list reconcile with server state; badge counts stored relations including placeholders as a documented proposed default.

## Tests/evidence owned by this member

- [ ] Unit/component tests for rental request validation, heart intent serialization, error recovery and guest/account-switch behavior.
- [ ] PostgreSQL/API tests for duplicate pending rental requests, ownership, reject/withdraw races, unique favourite saves and hidden-content privacy.
- [ ] API integration tests for saved property, rental request and owner request-list actions; manually check changed screens and confirm there is no standalone Accept action or reservation on request submission.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-04, NFR-07

NFR-02, NFR-03, NFR-04, NFR-07; T3c, T3e, T4a, T3g, T4d
Audit already-implemented favourites code and retain compatible work. Rebuild tasks from requirements rather than recreating deleted issue references.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-07 is a planning key, not a GitHub number. Deleted issues are not reused.
