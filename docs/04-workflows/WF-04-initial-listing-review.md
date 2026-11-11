# WF-04 Submit and review initial listing

Actors: Owner and admin

Requirements: FR12 FR13 FR14 FR15 FR55

## Preconditions and trigger
First approval not yet granted; complete package. Trigger is the named user action or due system evaluation.

## Main flow
1. Validate address, marketed units and required photos/terms.
2. Capture listing and property content revisions; mark PENDING.
3. Admin reviews full linked package, approves or rejects with reason.
4. Store audit/outbox; approval does not publish.

## Alternative and failure flows
- Concurrent content edit invalidates stale approval.
- Two admin terminal decisions yield one winner.

## Postcondition
APPROVED or REJECTED initial decision; no independent property/photo review.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
