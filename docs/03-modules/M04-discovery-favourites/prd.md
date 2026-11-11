# Landing page, location/date search and private favourites — PRD

## Outcome

Visitors browse safe public advertisements. Location and the other unit filters must match one eligible unit. When a move-in date is set, that same unit must be free for the implied stay.

## Scope and screens/actions

- Landing page, search, cards, and detail. Location searches the stored address, ward, and city. Filter URLs and pagination are preserved. Maps, GPS, radius, and geocoding stay out of the MVP.
- With no move-in date, a listing stays in the results even when every unit is held. The card label and available count describe units free today, and the rent range includes every eligible unit, including held ones. A move-in date removes the listing unless one unit is free for the implied stay. Search never reserves properties or units.
- Authenticated property-level heart saves are private, persistent and idempotent; hidden targets become generic removable placeholders. No contact/reservation side effect.

## Functional requirements

### FR19 — Search listings by location and date-based availability

**Priority:** P0 Must. **Actors:** Guest; User. **Delivery:** Primary: RNT-06.

Search public eligible listings by text/address and paginated filters. The visitor enters one move-in date. The stay ends at that date plus the unit’s minimum rental months. There is no search end date. A unit qualifies when that stay has no blocking tenancy overlap. With no move-in date, a listing stays in the results even when every unit is held. The card label and available count describe units free today, for example “Trống từ 02/05/2027” with count 0, or “Còn trống đến 31/01/2027” with count 1. Sending a move-in date removes the listing unless one unit is free for the whole implied stay. The listing stays published either way. Never use property RENTED or a stored availability count. Location searches the stored property address, ward, and city. Trim and collapse whitespace and match case-insensitively while preserving Vietnamese text. Combine location and other filters. The move-in date and unit filters must match one eligible unit for the whole implied stay. Preserve filters in the URL and pagination, and clear location independently. Maps, GPS, radius, and geocoding remain deferred.

Acceptance: [6 cases for FR19](../../06-acceptance/test-scenarios.md#fr19); IDs FR19-AC01, FR19-AC02, FR19-AC03, FR19-AC04, FR19-AC05, FR19-AC06.

### FR20 — Filter eligible units for the full requested interval

**Priority:** P0 Must. **Actors:** Guest; User. **Delivery:** Primary: RNT-06.

Support price, unit kind, bedrooms, bathrooms, catalog amenities, and pets on the same eligible unit. Area range and occupant count are not search filters. A move-in date is optional. When it is set, the stay is that date plus the unit’s minimum rental months, checked as a half-open range against blocking tenancies. Amenity filters use canonical catalog keys with enabled=true on eligible units or property scope. Distinguish shared laundry from an in-unit washing machine. Custom descriptions never automatically match standard filters (FR87).

Acceptance: [4 cases for FR20](../../06-acceptance/test-scenarios.md#fr20); IDs FR20-AC01, FR20-AC02, FR20-AC03, FR20-AC04.

### FR21 — Display listing details and eligible unit cards

**Priority:** P0 Must. **Actors:** Guest; User. **Delivery:** Primary: RNT-06.

Show the shared gallery, advertised rules, unit photos, specifications, prices, and availability. Listing detail does not reapply the search move-in date. When the listing still has at least one available unit, held units stay on the page with their held label. Saving an enquiry is FR25 in RNT-07, not this requirement. Never display agreement documents or other prospects’ contact details. Display canonical localized amenity labels with owner details, separating shared property facilities, private unit features, and additional custom text (FR87).

Acceptance: [4 cases for FR21](../../06-acceptance/test-scenarios.md#fr21); IDs FR21-AC01, FR21-AC02, FR21-AC03, FR21-AC04.

### FR22 — Interactive listing map

**Priority:** P2 Defer. **Actors:** Guest; User. **Delivery:** Deferred — no MVP implementation.

Optional map of eligible listings with valid approximate/public coordinates. Keep exact private information out of marker payloads.

Acceptance: [2 cases for FR22](../../06-acceptance/test-scenarios.md#fr22); IDs FR22-AC01, FR22-AC02.

### FR23 — Synchronize map and filters

**Priority:** P2 Defer. **Actors:** Guest; User. **Delivery:** Deferred — no MVP implementation.

Use same normalized filter service for map and list; map bounding changes have explicit URL/query state.

Acceptance: [2 cases for FR23](../../06-acceptance/test-scenarios.md#fr23); IDs FR23-AC01, FR23-AC02.

### FR24 — Geocode address

**Priority:** P2 Defer. **Actors:** System; Owner. **Delivery:** Deferred — no MVP implementation.

Optional asynchronous address-to-coordinate conversion after saving address. Manual address remains authoritative when provider fails.

Acceptance: [3 cases for FR24](../../06-acceptance/test-scenarios.md#fr24); IDs FR24-AC01, FR24-AC02, FR24-AC03.

### FR40 — Public listing REST resources

**Priority:** P0 Must. **Actors:** Guest; API client. **Delivery:** Primary: RNT-06.

Expose GET listing collection/detail using one public eligibility service; include safe unit/media/policy DTOs, pagination and errors.

Acceptance: [3 cases for FR40](../../06-acceptance/test-scenarios.md#fr40); IDs FR40-AC01, FR40-AC02, FR40-AC03.

### FR46 — Cache public listing content with fresh visibility checks

**Priority:** P1 Should. **Actors:** System. **Delivery:** Primary: RNT-11.

Next.js/TanStack Query may cache public reads. Invalidate on content, media, policy, suspension and allocation changes. Public detail/API must gate current hidden/suspended status; availability remains indicative until transactional proposal creation.

Acceptance: [3 cases for FR46](../../06-acceptance/test-scenarios.md#fr46); IDs FR46-AC01, FR46-AC02, FR46-AC03.

### FR77 — Calculate availability counts and rent ranges

**Priority:** P0 Must. **Actors:** System. **Delivery:** Primary: RNT-06.

For each selected interval, eligible unit has complete required listing data, is READY, marketed, nonarchived, minimum-duration compliant and has no overlap with blocking tenancy envelope. Pending-confirmation holds count as blocked until explicit expiry release. Count and rent range derive from same qualifying query. Without dates use each unit minimum term from today.

Acceptance: [4 cases for FR77](../../06-acceptance/test-scenarios.md#fr77); IDs FR77-AC01, FR77-AC02, FR77-AC03, FR77-AC04.

### FR88 — Save and manage favourite properties

**Priority:** P0 Must. **Actors:** Authenticated user. **Delivery:** Primary: RNT-07.

Private authenticated property-level persistent saves, idempotent intended-state writes, safe hidden placeholders and private list/count. Saving creates no rental request/reservation.

Acceptance: [10 cases for FR88](../../06-acceptance/test-scenarios.md#fr88); IDs FR88-AC01, FR88-AC02, FR88-AC03, FR88-AC04, FR88-AC05, FR88-AC06, FR88-AC07, FR88-AC08, FR88-AC09, FR88-AC10.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
