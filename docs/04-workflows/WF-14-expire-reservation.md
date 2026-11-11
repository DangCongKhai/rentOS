# WF-14 Expire unconfirmed reservation

Actors: System

Requirements: FR83

## Preconditions and trigger
Server deadline due; exact current pending version. Trigger is the named user action or due system evaluation.

## Main flow
1. Claim with shared locks and recheck pointer/deadline.
2. Original becomes EXPIRED; clear hold/pending metadata.
3. Renewal expiry releases only extension and keeps confirmed agreement/request pending.
4. Audit and notification after commit; proposal path can reap due holds.

## Alternative and failure flows
- Old worker cannot expire newer correction or confirmed agreement.
- Delayed worker blocks conservatively until explicit release; no now() in GiST predicate.

## Postcondition
Expired pending work cannot retain a permanent temporary reservation.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
