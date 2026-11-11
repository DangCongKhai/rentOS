<!-- rentos-backlog-v2: RNT-06 -->

# RNT-06: Build the landing page, browse/search listings and view listing details

## Outcome

Visitors use the landing page to browse public rental listings, search by location and a move-in date, filter results, and view listing details and available units.

## Ownership and order

- Phase 2.
- Implementation: **Khai** (frontend + backend + own tests).
- Reviewer: **Kien**.
- Prerequisites: [RNT-02](RNT-02.md), [RNT-03](RNT-03.md), [RNT-04](RNT-04.md).
- GitHub: https://github.com/ndrhmdk/rentOS/issues/101

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR19 — Search listings by location and date-based availability** (P0 Must): Search public eligible listings by text/address and paginated filters. The visitor enters one move-in date. The stay ends at that date plus the unit’s minimum rental months. There is no search end date. A unit qualifies when that stay has no blocking tenancy overlap. With no move-in date, a listing stays in the results even when every unit is held. The card label and available count describe units free today, for example “Trống từ 02/05/2027” with count 0, or “Còn trống đến 31/01/2027” with count 1. Sending a move-in date removes the listing unless one unit is free for the whole implied stay. The listing stays published either way. Never use property RENTED or a stored availability count. Location searches the stored property address, ward, and city. Trim and collapse whitespace and match case-insensitively while preserving Vietnamese text. Combine location and other filters. The move-in date and unit filters must match one eligible unit for the whole implied stay. Preserve filters in the URL and pagination, and clear location independently. Maps, GPS, radius, and geocoding remain deferred.
  - [All 6 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr19)
- **FR20 — Filter eligible units for the full requested interval** (P0 Must): Support price, unit kind, bedrooms, bathrooms, catalog amenities, and pets on the same eligible unit. Area range and occupant count are not search filters. A move-in date is optional. When it is set, the stay is that date plus the unit’s minimum rental months, checked as a half-open range against blocking tenancies. Amenity filters use canonical catalog keys with enabled=true on eligible units or property scope. Distinguish shared laundry from an in-unit washing machine. Custom descriptions never automatically match standard filters (FR87).
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr20)
- **FR21 — Display listing details and eligible unit cards** (P0 Must): Show the shared gallery, advertised rules, unit photos, specifications, prices, and availability. Listing detail does not reapply the search move-in date. When the listing still has at least one available unit, held units stay on the page with their held label. Saving an enquiry is FR25 in RNT-07, not this requirement. Never display agreement documents or other prospects’ contact details. Display canonical localized amenity labels with owner details, separating shared property facilities, private unit features, and additional custom text (FR87).
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr21)
- **FR40 — Public listing REST resources** (P0 Must): Expose GET listing collection/detail using one public eligibility service; include safe unit/media/policy DTOs, pagination and errors.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr40)
- **FR77 — Calculate availability counts and rent ranges** (P0 Must): For a selected move-in date, an eligible unit has complete required listing data, is READY, marketed, nonarchived, minimum-duration compliant, and has no overlap with the blocking tenancy envelope for the implied stay. Pending-confirmation holds count as blocked until explicit expiry release. With no move-in date, the available count describes units free today and the rent range includes every eligible unit, including held ones. A move-in date counts only units free for the implied stay.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr77)

## Backend deliverables

- [ ] Implement public search/detail Resources with text/address and price, unit kind, bedroom, bathroom, catalog amenity, and pet filters on the SAME eligible unit for the implied stay when a move-in date is set. Compute eligible counts and rent ranges from READY operational state and blocking tenancy dates. With no move-in date, keep a listing whose units are held and label the units that are free today. Use bounded pagination and eager loading.
- [ ] Implement server-side location search over the stored address, ward, and city. Trim and collapse whitespace and match case-insensitively while preserving Vietnamese text. Combine location and all selected filters. When a move-in date is set, that date and the unit criteria must match the same unit for the implied stay. Bind query parameters and keep counts and pagination consistent.
- [ ] Use one public visibility rule shared with owner listing publication and admin suspension; return only safe public fields. Kien owns listing write endpoints in RNT-02.

## Frontend deliverables

- [ ] Build the public landing page, navigation, search entry and listing cards. Link Manage rentals to the signed-in owner area and preserve compatible existing design/assets.
- [ ] Build responsive public search/filter/cards/details and eligible unit selector with clear loading/empty/error states, preserved filter URLs and accessible navigation.
- [ ] Add a labeled location input/filter to public discovery; preserve location with the other filters and the move-in date in URL state and pagination. Show the selected location, clear/reset, and loading/error/no-results states on desktop.

## Acceptance criteria

- [ ] Owner-hidden/archived/suspended/unapproved content is excluded from public routes, and restore does not automatically republish an owner-hidden listing.
- [ ] A unit must satisfy all selected filters. When a move-in date is set, that same unit must be free for the implied stay. Different units cannot jointly satisfy one filter result.
- [ ] Adjacent bookings remain eligible, while overlapping reservations/confirmed periods and maintenance/retired units are excluded.
- [ ] Displayed availability counts and price range are based on the filtered eligible set, not all units or a permanent RENTED flag.
- [ ] Searching a stored address, ward, or city returns only matching public properties. Leading and trailing whitespace and letter case do not change results. A blank location removes only the location condition.
- [ ] Location and price, amenity, unit, and move-in filters are applied together. When a move-in date is set, a property in the matching place with no same-unit implied-stay match is excluded. Hidden listings remain excluded.
- [ ] Location persists across pagination/reload/back navigation; clearing it preserves other filters, and unknown locations show an empty state. MVP scope is address/locality search, without GPS, maps, radius or geocoding.
- [ ] The landing page and listing search/detail pages work on mobile and desktop with actual Laravel data, loading/error/no-results states and keyboard-accessible controls.

## Tests/evidence owned by this member

- [ ] Unit/component tests for landing-page search, filters, cards, date selection, location input and navigation.
- [ ] PostgreSQL/API tests for public visibility/privacy, full-period availability, same-unit filters, counts/prices and pagination.
- [ ] Manual UI check: landing page -> location/date search -> filtered results -> listing detail. Unapproved, hidden, archived or suspended listings never appear.
- [ ] Location normalization and query tests, plus API and component tests and manual UI checks, for address, ward, and city match, a wrong locality, empty or unknown input, Vietnamese text, parameter binding, combined same-unit filters, the move-in date, and URL, pagination, and reset behavior.

## NFRs, boundaries and coordination

NFR-01, NFR-02, NFR-03, NFR-04, NFR-07

NFR-01, NFR-02, NFR-03, NFR-04, NFR-07; T3e, T4a, T3g, T4d
Khai owns the complete browsing frontend/API/tests. Kien owns owner listing create/edit/submit/publish actions in RNT-02; Tri owns admin approval in RNT-04. Location means stored address, ward, and city search; maps, GPS, radius, and geocoding stay deferred. Browsing creates no reservation. RNT-11 improves search performance and applies the 15-day rule.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-06 is a planning key, not a GitHub number. Deleted issues are not reused.
