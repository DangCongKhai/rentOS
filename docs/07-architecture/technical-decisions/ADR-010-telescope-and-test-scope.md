# Shared Telescope setup and practical test requirements

Status: agreed project design; implementation unverified.

## Decision and reason

Khai installs/configures Telescope watchers/storage/access/filtering/pruning in RNT-01 (T5a). Tri adds correlation/diagnostics and actual alerts in RNT-12. Require unit/component/API/PostgreSQL integration and short manual UI checks, not browser/E2E automation. TypeScript generation is setup documentation only. All members supply their own tests and evidence.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
