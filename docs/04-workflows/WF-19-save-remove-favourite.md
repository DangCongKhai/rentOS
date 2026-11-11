# WF-19 Save or remove favourite property

Actors: Authenticated user

Requirements: FR88

## Preconditions and trigger
Property card/detail visible; known property UUID. Trigger is the named user action or due system evaluation.

## Main flow
1. Guest goes to login without anonymous server save.
2. Send PUT for desired saved or DELETE for desired unsaved; actor from the Sanctum-authenticated profile.
3. Persist unique user/property or delete own pair synchronously.
4. Update account-scoped heart/badge; serialize quick per-property writes and refetch.

## Alternative and failure flows
- Duplicate PUT one row; repeated DELETE204.
- On error revert/refetch UI; late response cannot override newer local intent.

## Postcondition
Saved property survives reload or is removed; no reservation/contact effect.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
