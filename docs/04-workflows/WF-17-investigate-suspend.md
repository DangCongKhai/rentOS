# WF-17 Investigate and suspend or restore

Actors: Admin

Requirements: FR39 FR78

## Preconditions and trigger
Trusted admin privilege, report or direct inspection. Trigger is the named user action or due system evaluation.

## Main flow
1. Read current content and audit history; mark report reviewing.
2. Resolve/dismiss with reason and private versus public notes.
3. If needed suspend listing independently of initial approval; invalidate visibility caches.
4. Explicit admin restoration after checking corrections; owner publication choice still respected.

## Alternative and failure flows
- Owner edit/publish cannot remove suspension.
- Two final report decisions yield one legal result.

## Postcondition
Audited admin outcome and safe public visibility.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
