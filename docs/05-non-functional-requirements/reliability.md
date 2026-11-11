# Reliability

Business/audit/outbox/replay transaction atomicity; external uploads are staged and compensated by orphan cleanup. Queue worker retries bounded and deduplicated; abandoned leases recover. Scheduler restarts/retries must not duplicate outcomes or release a newer reservation. Test DB23P01/unique conflicts, provider failures and network retries. Backups/restore procedure must be documented for chosen hosting; actual RPO/RTO undecided.

Validation is part of feature/engineering issues and PR evidence. Tool versions/configuration must match the local installed framework; no invented pass result.
