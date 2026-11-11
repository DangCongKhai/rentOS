# WF-13 Propose renewal contract segment

Actors: Owner

Requirements: FR70 FR84

## Preconditions and trigger
Pending renewal request and compatible future dates. Trigger is the named user action or due system evaluation.

## Main flow
1. Begin segment at confirmed_end+1day; enter negotiated terms/document.
2. Add RENEWAL under same tenancy, basis contract and renewal request.
3. Owner confirms row; expand blocked end only, retain confirmed end and pending request.
4. Run exact-contract confirmation workflow; only final agreement accepts renewal.

## Alternative and failure flows
- Existing future tenancy overlap fails expansion.
- Decline/expiry restores confirmed span and retains request pending; old rent stays current until new segment starts.

## Postcondition
Continuous tenancy with immutable original/renewal history.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
