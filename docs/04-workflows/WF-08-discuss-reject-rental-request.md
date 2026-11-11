# WF-08 Discuss or reject rental request

Actors: Owner

Requirements: FR29 FR31

## Preconditions and trigger
Own property PENDING rental request. Trigger is the named user action or due system evaluation.

## Main flow
1. Read private contact details.
2. Phone/view/sign discussion occurs offline while request stays PENDING.
3. Reject with required reason or open separate tenancy-proposal form.
4. Notify terminal rejection after commit.

## Alternative and failure flows
- Withdraw/propose/reject race has one terminal winner.
- No standalone manual Accept endpoint.

## Postcondition
PENDING discussion or reasoned REJECTED outcome.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
