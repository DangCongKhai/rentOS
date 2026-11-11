# WF-15 Evaluate15day automatic rejection

Actors: System

Requirements: FR85

## Preconditions and trigger
PENDING rental request age>=15days. Trigger is the named user action or due system evaluation.

## Main flow
1. Lock property/properties and units/request; reap due holds first.
2. Evaluate complete stored desired interval over eligible alternatives.
3. If any alternative fits keep pending and record check time.
4. If none fits reject NO_AVAILABLE_UNIT and audit/notify once.

## Alternative and failure flows
- Preferred unit is soft preference; manual hidden publication is not occupation.
- Concurrent addition/maintenance release/accept/withdraw is serialized; never shift past desired dates silently.

## Postcondition
Only due and genuinely unavailable rental request rejected.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
