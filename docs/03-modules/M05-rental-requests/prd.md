# Tenant rental requests and owner request lists — PRD

## Outcome

A rental request is an application/contact record. It stays PENDING throughout owner–tenant discussion outside the app.

## Scope and screens/actions

- Tenant contact/date/preferred-unit form, own status list and withdraw action; owner private request list/contact/reject action.
- No standalone owner Accept endpoint. Proposal creation commits ACCEPTED with a tenancy/version/reservation in one transaction.
- At age >=15 days, auto-reject only if no eligible alternative unit fits the complete stored interval. Reap expired reservations first; publication visibility is not physical occupation.

## Functional requirements

### FR25 — Submit rental request with contact details

**Priority:** P0 Must. **Actors:** Tenant. **Delivery:** Primary: RNT-07.

Authenticated tenant submits contact_name, contact_phone, desired_move_in_date, desired_end_date, optional preferred_unit_id and message. Store contact snapshots. Status PENDING throughout offline discussion. No calendar, manual discussion acceptance or unit reservation at rental request creation.

Acceptance: [5 cases for FR25](../../06-acceptance/test-scenarios.md#fr25); IDs FR25-AC01, FR25-AC02, FR25-AC03, FR25-AC04, FR25-AC05.

### FR26 — Prevent duplicate pending rental requests

**Priority:** P0 Must. **Actors:** Tenant. **Delivery:** Primary: RNT-07.

At most one PENDING request per tenant/listing; accepted/rejected/withdrawn history remains. Unique partial index is authoritative; retries compare payload.

Acceptance: [3 cases for FR26](../../06-acceptance/test-scenarios.md#fr26); IDs FR26-AC01, FR26-AC02, FR26-AC03.

### FR27 — Tenant rental request dashboard

**Priority:** P0 Must. **Actors:** Tenant. **Delivery:** Primary: RNT-07.

Display private submitted contacts, desired dates, request status/outcome and linked tenancy confirmation state. ACCEPTED means proposal created, not that tenancy contract is mutually confirmed.

Acceptance: [4 cases for FR27](../../06-acceptance/test-scenarios.md#fr27); IDs FR27-AC01, FR27-AC02, FR27-AC03, FR27-AC04.

### FR28 — Withdraw pending rental request

**Priority:** P0 Must. **Actors:** Tenant. **Delivery:** Primary: RNT-07.

Tenant may withdraw own PENDING request with audit and owner notification. Accepted requests are handled through tenancy proposal actions instead.

Acceptance: [3 cases for FR28](../../06-acceptance/test-scenarios.md#fr28); IDs FR28-AC01, FR28-AC02, FR28-AC03.

### FR29 — Owner rental request inbox

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-07.

Owner sees own property requests and private tenant contact snapshots, dates and preferred unit. Discuss offline while PENDING. Actions are Reject and Create tenancy proposal; no viewing/calendar or stand-alone Accept.

Acceptance: [4 cases for FR29](../../06-acceptance/test-scenarios.md#fr29); IDs FR29-AC01, FR29-AC02, FR29-AC03, FR29-AC04.

### FR30 — Accept request when tenancy proposal commits

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-05.

Create tenancy, immutable ORIGINAL contract version, explicit owner confirmation, temporary reservation, audit and outbox; change rental request PENDING to ACCEPTED in the same transaction. Tenant confirmation follows separately.

Acceptance: [4 cases for FR30](../../06-acceptance/test-scenarios.md#fr30); IDs FR30-AC01, FR30-AC02, FR30-AC03, FR30-AC04.

### FR31 — Reject pending rental request

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-07.

Owner can reject PENDING rental request with reason; no viewing cancellation or automatic rejection merely because another rental request was accepted. System auto-rejection uses FR85.

Acceptance: [3 cases for FR31](../../06-acceptance/test-scenarios.md#fr31); IDs FR31-AC01, FR31-AC02, FR31-AC03.

### FR32 — Audit request and tenancy outcomes

**Priority:** P0 Must. **Actors:** System. **Delivery:** Primary: RNT-07.

Append-only audit events record request status, proposal/confirmation/version changes and automatic decisions with actor/system identity, safe before/after, reason and correlation UUID.

Acceptance: [4 cases for FR32](../../06-acceptance/test-scenarios.md#fr32); IDs FR32-AC01, FR32-AC02, FR32-AC03, FR32-AC04.

### FR85 — Apply 15-day rejection using actual availability

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-11.

Assumption: a PENDING rental request becomes eligible for auto-rejection at created_at+15 days. Reject with NO_AVAILABLE_UNIT only if no READY/marketed/nonarchived eligible unit in the listing property covers the complete desired interval. A preferred unit is a preference, so consider alternatives. Do not reject only because request aged15 days or another request accepted. Exclude admin/publication visibility from physical availability test; hiding is not occupation.

Acceptance: [8 cases for FR85](../../06-acceptance/test-scenarios.md#fr85); IDs FR85-AC01, FR85-AC02, FR85-AC03, FR85-AC04, FR85-AC05, FR85-AC06, FR85-AC07, FR85-AC08.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
