# WF-25 Record actual move-in

Actors: Owner

Requirements: FR80

## Preconditions and trigger
Confirmed original agreement and start date reached. Trigger is the named user action or due system evaluation.

## Main flow
1. Recheck same tenancy current lifecycle.
2. Record moved_in_at and set ACTIVE.
3. Audit without changing agreement/blocking period.

## Alternative and failure flows
- Before start/unconfirmed/cancelled denied; cancellation race serialized.

## Postcondition
Actual move-in recorded, not inferred from clock.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
