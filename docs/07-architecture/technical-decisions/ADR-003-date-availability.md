# Operational state and date-qualified availability

Status: agreed project design; implementation unverified.

## Decision and reason

READY/MAINTENANCE/RETIRED is operational. Determine vacancy from entire requested interval and blocking tenancy envelope. Pending confirmation temporarily reserves dates; PostgreSQL GiST exclusion rejects overlap. Adjacent bookings are allowed. Expiry requires an explicit locked action; no time-dependent now() predicate in the constraint.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
