# Project glossary

See [domain terminology](../02-domain/terminology.md) for product names.

| Term | Meaning |
| --- | --- |
| FR | Stable functional requirement identifier; gaps are historical, not missing features |
| AC | Acceptance specification, not an executed test result |
| RNT-xx | Planning key for a grouped issue; not a GitHub issue number |
| Primary issue | First implementation owner; later verification does not transfer ownership |
| Revision | Expected version of mutable content, checked to reject stale writes |
| Idempotency key | Actor/action-scoped create/retry intent; different payload with same key is rejected |
| Outbox | Committed event record delivered by a worker after business commit |
| Telescope pruning | Deletion of old diagnostic entries, distinct from business audit history and stored photo-file deletion |
| Server cache invalidation | Remove/version Laravel cache data after relevant committed changes |
| Query invalidation | Mark/refetch matching TanStack Query data in the current client |
| P2 | Deferred feature, not an MVP implementation/test obligation |
