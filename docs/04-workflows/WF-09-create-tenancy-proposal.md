# WF-09 Create tenancy proposal

Actors: Owner

Requirements: FR30 FR33 FR34 FR67

## Preconditions and trigger
Pending rental request; exact ready unit has compatible dates. Trigger is the named user action or due system evaluation.

## Main flow
1. Enter actual negotiated dates/rent/deposit/policy snapshot and private document.
2. Owner explicitly acknowledges exact contract/hash.
3. Lock and validate; create tenancy, ORIGINAL contract, owner confirmation, blocking span and deadline.
4. Atomically accept rental request, audit/outbox/replay; invite tenant after commit.

## Alternative and failure flows
- GiST overlap or validation failure rolls back request acceptance and hold.
- Other rental requests are not immediately auto-rejected.

## Postcondition
ACCEPTED rental request plus PENDING_CONFIRMATION tenancy; no mutual agreement yet.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
