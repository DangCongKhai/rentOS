# WF-18 View tenancy and contract history

Actors: Related owner/tenant

Requirements: FR35 FR71

## Preconditions and trigger
Authorized private relationship. Trigger is the named user action or due system evaluation.

## Main flow
1. Display request outcome and tenancy lifecycle separately.
2. List all immutable versions, predecessor/basis, timestamps and decisions.
3. Resolve current agreed rent only from confirmed segment covering date.
4. Authorize short-lived document download on every request.

## Alternative and failure flows
- Unrelated requester denied.
- No covering confirmed segment means no confirmed terms for date, not proposed rent fallback.

## Postcondition
Traceable historical/current/upcoming agreement view.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
