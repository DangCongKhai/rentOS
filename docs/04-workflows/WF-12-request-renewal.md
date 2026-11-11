# WF-12 Request renewal

Actors: Tenant

Requirements: FR68 FR69

## Preconditions and trigger
Related CONFIRMED/ACTIVE tenancy; no pending/upcoming renewal workflow. Trigger is the named user action or due system evaluation.

## Main flow
1. Enter later requested end, proposed rent and message.
2. Validate requester and proposal; save one PENDING renewal request.
3. Notify owner; discuss offline without changing agreement/range.
4. Tenant may cancel or owner reject with reason, releasing any unconfirmed extension.

## Alternative and failure flows
- Parallel request unique constraint permits one pending.
- No automatic extension from request submission.

## Postcondition
Pending proposal or terminal request rejection/cancellation.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
