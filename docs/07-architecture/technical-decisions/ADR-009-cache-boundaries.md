# TanStack Query versus shared Laravel cache

Status: agreed project design; implementation unverified.

## Decision and reason

Frontend QueryClient invalidation only affects that client cache. RNT-11 implements bounded public Laravel caching with documented keys/invalidation/current visibility gate and private account isolation. Already-open browser pages may remain stale until refetch; no unspecified instant push promise. Cache never authorizes tenancy allocation.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
