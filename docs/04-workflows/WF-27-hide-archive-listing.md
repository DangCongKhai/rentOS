# WF-27 Hide or archive listing

Actors: Owner

Requirements: FR18

## Preconditions and trigger
Own listing. Trigger is the named user action or due system evaluation.

## Main flow
1. Choose hide/archive; audit and invalidate public access.
2. Retain related private rental request/tenancy history.
3. Republish only via publication workflow; no automatic republish when unit becomes free.

## Alternative and failure flows
- Owner cannot clear admin suspension.

## Postcondition
Owner publication choice separate from physical availability.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
