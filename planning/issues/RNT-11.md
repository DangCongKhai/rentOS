<!-- rentos-backlog-v2: RNT-11 -->

# RNT-11: Apply the 15-day request rule, cache public search results and refresh them after listing changes

## Outcome

Aged rental requests are rejected only when no eligible full-period unit exists; cached discovery remains fresh and private.

## Ownership and order

- Phase 3.
- Implementation: **Hien** (frontend + backend + own tests).
- Reviewer: **Khai**.
- Prerequisites: [RNT-06](RNT-06.md), [RNT-07](RNT-07.md), [RNT-09](RNT-09.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR46 — Cache public listing content with fresh visibility checks** (P1 Should): Next.js/TanStack Query may cache public reads. Invalidate on content, media, policy, suspension and allocation changes. Public detail/API must gate current hidden/suspended status; availability remains indicative until transactional proposal creation.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr46)
- **FR85 — Apply 15-day rejection using actual availability** (P0 Must): Assumption: a PENDING rental request becomes eligible for auto-rejection at created_at+15 days. Reject with NO_AVAILABLE_UNIT only if no READY/marketed/nonarchived eligible unit in the listing property covers the complete desired interval. A preferred unit is a preference, so consider alternatives. Do not reject only because request aged15 days or another request accepted. Exclude admin/publication visibility from physical availability test; hiding is not occupation.
  - [All 8 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr85)

## Backend deliverables

- [ ] Implement the >=15-day pending-rental request job using current full-interval availability across eligible alternatives, after reaping due holds under the common lock order. Preferred unit is soft; visibility is not proof of occupation.
- [ ] Implement public response caching/revalidation with fresh visibility checks and invalidation after publish/hide/archive/suspend/edit; keep private contacts/favourites/contracts in account-scoped private responses.
- [ ] Measure/eager-load/index listing queries and bound pagination; record local query counts/plans and validate hosted timing separately without inventing latency budgets.
- [ ] Exclude session/CSRF/password-reset/API-token management and one-time token secrets from shared response caches; clear prior-account private browser data on session logout.

## Frontend deliverables

- [ ] Show auto-rejection reason/status in tenant/owner rental-request lists and refresh availability/counts after relevant mutations.
- [ ] Implement responsive images, lazy noncritical resources, race-safe filter/search responses and account-private heart hydration with failure/retry states.

## Acceptance criteria

- [ ] Age alone or another tenant’s acceptance never rejects a pending rental request if an eligible alternate unit fits the whole desired interval.
- [ ] Partial availability, maintenance and real blocking reservations prevent false matches; hidden listing status alone cannot establish occupation.
- [ ] Ageing versus withdrawal/proposal/expiry races produce one valid audited outcome and retried jobs are idempotent.
- [ ] Hidden/suspended content is not served through a stale shared cache; owner restore does not bypass owner publication.
- [ ] No private heart/contact/contract fields enter a shared listing cache and switching accounts clears private state.
- [ ] On the same seeded dataset, record listing query counts and query plans, remove repeated per-unit lookups, and verify pagination. Repeating the same public search uses its cache; a listing hide/edit invalidates or revalidates it so stale public details are not returned.

## Tests/evidence owned by this member

- [ ] Unit/component tests for boundary ages, availability alternatives, cached/search race handling and UI rejection states.
- [ ] PostgreSQL worker/API tests for full interval, alternate units and independent ageing/proposal/withdrawal races.
- [ ] Cache invalidation/privacy integration tests and recorded query counts/plans on the same seed; manually inspect resource downloads in browser developer tools.

## NFRs, boundaries and coordination

NFR-01, NFR-02, NFR-03, NFR-04, NFR-05, NFR-07

NFR-01, NFR-02, NFR-03, NFR-04, NFR-05, NFR-07; T6b, T6c, T6d, T3g, T4d
15-day interpretation and proposed 48h expiry are explicit product defaults. Do not silently turn either into unconditional rejection or time-dependent exclusion predicates.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-11 is a planning key, not a GitHub number. Deleted issues are not reused.
