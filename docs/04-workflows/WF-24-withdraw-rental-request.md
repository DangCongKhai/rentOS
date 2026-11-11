# WF-24 Withdraw pending rental request

Actors: Tenant

Requirements: FR28

## Preconditions and trigger
Own pending rental request. Trigger is the named user action or due system evaluation.

## Main flow
1. Open own rental request and confirm withdrawal.
2. Lock request and recheck pending.
3. Set WITHDRAWN, audit and notify owner after commit.

## Alternative and failure flows
- Proposal may win first; accepted rental request directs to tenancy workflow instead.

## Postcondition
No pending thread or reservation side effect.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
