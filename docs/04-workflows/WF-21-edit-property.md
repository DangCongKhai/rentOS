# WF-21 Edit property and units

Actors: Owner

Requirements: FR08 FR51 FR52 FR55

## Preconditions and trigger
Own properties and units. Trigger is the named user action or due system evaluation.

## Main flow
1. Submit editable fields and expected revision.
2. Validate operational state/numeric terms; lock common property content.
3. Audit changed values and bump own/content revisions.
4. First-review snapshot invalidates before approval; later valid content appears directly without reapproval.

## Alternative and failure flows
- Stale409; archive/maintenance races use shared lock.
- Do not alter existing contract terms or auto-cancel occupancies.

## Postcondition
Updated properties and units and coherent first-review/public caches.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
