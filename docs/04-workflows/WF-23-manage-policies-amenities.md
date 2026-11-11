# WF-23 Manage policies and amenities

Actors: Owner

Requirements: FR60 FR61 FR87

## Preconditions and trigger
Own property/unit form. Trigger is the named user action or due system evaluation.

## Main flow
1. Load canonical amenity catalog and allowed policy schemas.
2. Select standard keys or add plain custom text; preserve shared/private scope.
3. NFC/trim/whitespace normalization and local casefold dedup; validate allowlists/types/limits.
4. Save with revision/content lock/audit; contracts store negotiated snapshots independently.

## Alternative and failure flows
- Unknown standard key/owner_label/scope rejected; no automatic semantic slug mapping.
- Shared policy rules cannot be removed via unit overrides.

## Postcondition
Controlled JSONB and predictable canonical filters.

## Consistency boundary
Use current revisions/Policies and the shared actions; state-changing flows capture audit/outbox/replay where required. A read/favourite is never an allocation authority.


## Delivery and evidence

See the [traceability matrix](../06-acceptance/traceability-matrix.md) for responsible issues and all acceptance specifications. Private browser write actions use Sanctum sessions, CSRF and Policies; token-enabled actions also enforce PAT abilities; apply audit/idempotency/locking only where the domain action requires them. Manual screen checks complement unit/component/API integration tests; no required E2E suite.
