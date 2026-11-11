# WF-02 Create and bulk-create units

Actors: Owner

Requirements: FR50 FR51 FR52

## Preconditions and trigger
Own property exists. Trigger is the named user action or due system evaluation.

## Main flow
1. Edit sole whole-space unit or add units under SEPARATE_UNITS.
2. Bulk form accepts count/prefix/start/defaults; generate editable preview, no LLM.
3. Validate all rows, labels and term limits; save atomically with per-row operation keys.
4. New units are not marketed until complete and explicitly selected.

## Alternative and failure flows
- WHOLE_SPACE second unit rejected.
- Duplicate normalized labels/concurrent batches cause conflict and full batch rollback.

## Postcondition
Independent unit records saved; no listing or occupancy created.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
