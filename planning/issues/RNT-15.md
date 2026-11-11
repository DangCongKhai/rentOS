<!-- rentos-backlog-v2: RNT-15 -->

# RNT-15: Check tenant account/search/request/favourite behavior, API responses and test coverage

## Outcome

Discovery, favourites and rental requests remain coherent through full rental/renewal flows, and explicit API contracts plus both coverage reports are trustworthy.

## Ownership and order

- Phase 4.
- Implementation: **Hien** (frontend + backend + own tests).
- Reviewer: **Khai**.
- Prerequisites: [RNT-07](RNT-07.md), [RNT-09](RNT-09.md), [RNT-11](RNT-11.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR19 — Search listings by location and date-based availability** (P0 Must): Search public eligible listings by text/address and paginated filters. The visitor enters one move-in date. The stay ends at that date plus the unit’s minimum rental months. There is no search end date. A unit qualifies when that stay has no blocking tenancy overlap. With no move-in date, a listing stays in the results even when every unit is held. The card label and available count describe units free today, for example “Trống từ 02/05/2027” with count 0, or “Còn trống đến 31/01/2027” with count 1. Sending a move-in date removes the listing unless one unit is free for the whole implied stay. The listing stays published either way. Never use property RENTED or a stored availability count. Location searches the stored property address, ward, and city. Trim and collapse whitespace and match case-insensitively while preserving Vietnamese text. Combine location and other filters. The move-in date and unit filters must match one eligible unit for the whole implied stay. Preserve filters in the URL and pagination, and clear location independently. Maps, GPS, radius, and geocoding remain deferred.
  - [All 6 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr19)
- **FR20 — Filter eligible units for the full requested interval** (P0 Must): Support price, unit kind, bedrooms, bathrooms, catalog amenities, and pets on the same eligible unit. Area range and occupant count are not search filters. A move-in date is optional. When it is set, the stay is that date plus the unit’s minimum rental months, checked as a half-open range against blocking tenancies. Amenity filters use canonical catalog keys with enabled=true on eligible units or property scope. Distinguish shared laundry from an in-unit washing machine. Custom descriptions never automatically match standard filters (FR87).
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr20)
- **FR21 — Display listing details and eligible unit cards** (P0 Must): Show the shared gallery, advertised rules, unit photos, specifications, prices, and availability. Listing detail does not reapply the search move-in date. When the listing still has at least one available unit, held units stay on the page with their held label. Saving an enquiry is FR25 in RNT-07, not this requirement. Never display agreement documents or other prospects’ contact details. Display canonical localized amenity labels with owner details, separating shared property facilities, private unit features, and additional custom text (FR87).
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr21)
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
- **FR40 — Public listing REST resources** (P0 Must): Expose GET listing collection/detail using one public eligibility service; include safe unit/media/policy DTOs, pagination and errors.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr40)
- **FR46 — Cache public listing content with fresh visibility checks** (P1 Should): Next.js/TanStack Query may cache public reads. Invalidate on content, media, policy, suspension and allocation changes. Public detail/API must gate current hidden/suspended status; availability remains indicative until transactional proposal creation.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr46)
- **FR77 — Calculate availability counts and rent ranges** (P0 Must): For each selected interval, eligible unit has complete required listing data, is READY, marketed, nonarchived, minimum-duration compliant and has no overlap with blocking tenancy envelope. Pending-confirmation holds count as blocked until explicit expiry release. Count and rent range derive from same qualifying query. Without dates use each unit minimum term from today.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr77)
- **FR85 — Apply 15-day rejection using actual availability** (P0 Must): Assumption: a PENDING rental request becomes eligible for auto-rejection at created_at+15 days. Reject with NO_AVAILABLE_UNIT only if no READY/marketed/nonarchived eligible unit in the listing property covers the complete desired interval. A preferred unit is a preference, so consider alternatives. Do not reject only because request aged15 days or another request accepted. Exclude admin/publication visibility from physical availability test; hiding is not occupation.
  - [All 8 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr85)
- **FR88 — Save and manage favourite properties** (P0 Must): Private authenticated property-level persistent saves, idempotent intended-state writes, safe hidden placeholders and private list/count. Saving creates no rental request/reservation.
  - [All 10 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr88)

## Backend deliverables

- [ ] Fix discovered search/request/favourite pagination, privacy, availability and serialization defects; verify actual Resource responses against exported OpenAPI, especially conditional fields/JSONB/decimal/date/nullability.
- [ ] Coordinate separate meaningful UI/business and API coverage reports strictly above 70%; all members supply their own feature tests and fix gaps in their areas.
- [ ] Ensure API response tests and maintained frontend types detect response breaking changes and account-private caches stay isolated across integration journeys.

## Frontend deliverables

- [ ] Manually check listing search, save/remove favourite, rental-request submission/status, contract viewing and renewal status across member-owned APIs; fix confirmed UI errors with component tests.
- [ ] Fix keyboard/accessibility, hidden-placeholder, stale-response and re-authentication errors in desktop.

## Acceptance criteria

- [ ] The real tenant journey completes across independently implemented modules, with correct pending rental request versus pending-confirmation agreement labels.
- [ ] Suspended content is unavailable in search/detail/favourites without private field leakage; account switching clears all previous private state.
- [ ] A deliberate incompatible serialized response change fails response-contract tests and relevant frontend checks, and actual JSON responses agree with the published schema.
- [ ] Both required coverage reports exceed 70% without exclusions that hide core business logic; full PostgreSQL constraints are not replaced by mocks.
- [ ] Unit/component and API/PostgreSQL integration tests run from documented commands in CI. Automated browser/E2E suites are not required.
- [ ] Observed cross-module defects have regression tests and API documentation and maintained response types are updated.

## Tests/evidence owned by this member

- [ ] Focused unit/component tests for discovered search/cache/type/UI defects.
- [ ] API response, authorization and PostgreSQL integration tests for tenant actions; use a short manual UI checklist for navigation across screens.
- [ ] Separate measured frontend/business and backend API coverage plus a deliberately failing response-contract test.
- [ ] Component/API tests for combined location/date/amenity search and location URL persistence; manually verify reload/back navigation.
- [ ] Component/API regression checks cover token-settings one-time display and revoke, session account switching and 401/419 form recovery without automatic duplicate writes.

## NFRs, boundaries and coordination

NFR-01, NFR-02, NFR-03, NFR-04, NFR-07

NFR-01, NFR-02, NFR-03, NFR-04, NFR-07; T3e, T3g, T4d, T6c
Coverage is a team result, not permission to transfer everyone’s testing to Hien. Full-stack defects remain the responsibility of their owning feature developer.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-15 is a planning key, not a GitHub number. Deleted issues are not reused.
