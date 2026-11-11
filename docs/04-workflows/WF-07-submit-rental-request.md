# WF-07 Submit rental rental request

Actors: Tenant

Requirements: FR25 FR26 FR27

## Preconditions and trigger
Signed in; public target; no pending same tenant/listing. Trigger is the named user action or due system evaluation.

## Main flow
1. Collect contact snapshots, desired_start/end, message and optional preferred unit.
2. Validate ownership/scope/date range.
3. Persist request PENDING, audit and notification intent.
4. Show in tenant/owner inbox; no hold.

## Alternative and failure flows
- Duplicate parallel submissions yield one pending thread.
- No OTP verification claim; other tenants cannot read phone snapshot.

## Postcondition
PENDING contact rental request, no tenancy or allocation.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
