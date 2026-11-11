# One Laravel migration owner with isolated development

Status: agreed project design; implementation unverified.

## Decision and reason

Khai delivers initial complete schema/seeds and common tooling. Everyone uses committed migrations locally; feature owners request/review later additive migrations. Application tables live in the existing `public` schema. Prefer a reachable direct connection with SSL and a documented session fallback. CI uses isolated test DBs; reviewed main deploy serializes matching migrations/app/workers. No hosted destructive reset/reseed.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
