# Laravel workers and committed-event delivery

Status: agreed project design; implementation unverified.

## Decision and reason

Use database-backed Laravel Queue and workers for the MVP. The committed jobs row is the delivery record. Commit the domain change, the audit row, the inbox row, and the jobs row together, then deliver after commit. Retry and dedupe are the job's tries plus the Resend idempotency key on notifications.event_key. There is no outbox lease and no notification sweep. Scheduler handles due evaluations through the same domain actions. No Kafka/RabbitMQ or external queue platform is required.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
