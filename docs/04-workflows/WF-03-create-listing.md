# WF-03 Create listing draft

Actors: Owner

Requirements: FR10 FR11

## Preconditions and trigger
Own nonarchived property; no current listing. Trigger is the named user action or due system evaluation.

## Main flow
1. Select property and units to market.
2. Reuse linked specifications, media, policies and asking terms.
3. Enter title/description, choose selected same-property shared cover.
4. Preview and save DRAFT; next steps are separate initial review and publication.

## Alternative and failure flows
- Missing data allowed in draft but blocks submission.
- Concurrent same-property create rejected by partial unique index.

## Postcondition
One property-level draft, never one mandatory listing per unit.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
