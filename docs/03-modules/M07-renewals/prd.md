# Renewal requests and new contract segments — PRD

## Outcome

Renewal retains the same tenancy and historical agreement versions; it appends a new consecutive RENEWAL contract segment.

## Scope and screens/actions

- One PENDING renewal request per tenancy. Discussion does not accept it.
- Proposing reserves the extension while preserving current confirmed dates/terms; another future tenancy cannot overlap that extension.
- Mutual confirmation of the same version accepts the renewal and promotes confirmed dates. Decline/expiry releases only the proposed extension and leaves discussion pending.

## Functional requirements

### FR68 — Submit one pending renewal request

**Priority:** P0 Must. **Actors:** Tenant. **Delivery:** Primary: RNT-09.

Tenant on CONFIRMED/ACTIVE tenancy requests a later end date and proposed monthly rent. At most one PENDING renewal request per tenancy. Request alone changes no dates/availability. Allow one upcoming renewal workflow at a time; request proposal values remain immutable.

Acceptance: [4 cases for FR68](../../06-acceptance/test-scenarios.md#fr68); IDs FR68-AC01, FR68-AC02, FR68-AC03, FR68-AC04.

### FR69 — Withdraw or reject pending renewal request

**Priority:** P0 Must. **Actors:** Tenant; Owner. **Delivery:** Primary: RNT-09.

Tenant cancels or owner rejects PENDING renewal request with reason. If a pending renewal contract exists, invalidate its pending pointer and restore blocked envelope to confirmed dates in same transaction; old version/confirmations remain history.

Acceptance: [4 cases for FR69](../../06-acceptance/test-scenarios.md#fr69); IDs FR69-AC01, FR69-AC02, FR69-AC03, FR69-AC04.

### FR70 — Propose renewal as new immutable version

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-09.

Owner records negotiated consecutive continuation dates/rent/document from PENDING renewal request. Add RENEWAL contract version under same tenancy and owner confirmation, reserve extension via blocked envelope. Renewal request remains PENDING until tenant confirms same version; then mark ACCEPTED atomically with confirmed span expansion.

Acceptance: [6 cases for FR70](../../06-acceptance/test-scenarios.md#fr70); IDs FR70-AC01, FR70-AC02, FR70-AC03, FR70-AC04, FR70-AC05, FR70-AC06.

### FR84 — Reserve renewal extension without releasing current occupancy

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-09.

tenancies stores confirmed_start/end and blocked_start/end as transactional projections. Original unconfirmed proposal has only blocked dates. Confirmed tenancy with pending renewal expands blocked_end while confirmed_end stays unchanged. Decline/cancel/expiry restores blocked span to confirmed span; successful agreement promotes confirmed span.

Acceptance: [4 cases for FR84](../../06-acceptance/test-scenarios.md#fr84); IDs FR84-AC01, FR84-AC02, FR84-AC03, FR84-AC04.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
