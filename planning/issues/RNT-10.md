<!-- rentos-backlog-v2: RNT-10 -->

# RNT-10: Deliver private notifications from committed events with background jobs

## Outcome

A worker delivers each committed domain event once per recipient, into a private inbox and as one email. Photo-file retention is not part of this outcome.

## Ownership and order

- Phase 3.
- Implementation: **Khai** (frontend + backend + own tests).
- Reviewer: **Kien**.
- Prerequisites: [RNT-02](RNT-02.md), [RNT-05](RNT-05.md), [RNT-08](RNT-08.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR45 — Asynchronous domain notifications** (P1 Should): Write one `notifications` row and one database `jobs` row atomically with request/moderation/proposal/confirmation/renewal outcomes. Each inbox row has an audience of `ADMIN`, `TENANT`, or `OWNER`. Laravel queue workers deliver the email after commit, with retry and event deduplication. Use the database-backed Laravel Queue on Supabase PostgreSQL for MVP; no Kafka/RabbitMQ, no `notification_outbox`, and no viewing reminders.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr45)
- **FR59 — Delete unreferenced photo files after retention** (P1 Should): **Deferred.** This issue adds no retention job, no Storage delete, no photo-cleanup tests, and no photo-deletion dashboard. Owner upload and removal stay with the media work that already owns them (FR09, FR56, FR57). The M02 requirement is unchanged. [M02 PRD](../../docs/03-modules/M02-property-units-media/prd.md) and [RNT-14](RNT-14.md) still describe it. It is not delivered here.
- **FR73 — Private notification inbox** (P1 Should): Persist event-keyed in-app messages with safe links; unread/read state per recipient and audience. Email links navigate through authorized application routes, not permanent document URLs.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr73)

## Delivery design

The queue is the `jobs` table in the same Postgres database. `config/queue.php` sets the database connection `after_commit` to false, and `DB_QUEUE_CONNECTION` is unset, so a job dispatched inside the domain transaction commits or rolls back with that transaction. `queue:work` is the poller. Do not add a notification scheduler, and do not turn `after_commit` on.

Inside the caller's transaction, insert one `notifications` row and dispatch one job whose payload is only the notification id. A rollback leaves no inbox row and no job. Unique `(recipient_id, event_key)` stops a second inbox row. A retried business request is already stopped by `idempotency_records` before the writer runs.

Listing approve and reject call the writer with audience `OWNER` and the key `listing.approved:{listingId}:{operationId}` or `listing.rejected:...`. Proposal created, contract needs confirmation, contract confirmed, and renewal updated call the same writer when those actions exist. This issue does not invent those flows. FR45-AC01 and FR45-AC04 stay as the cases those later actions must meet. The inbox stores the resource id of the version the event is about.

The worker builds from, to, subject, and html from `title`, `body`, `resource_type`, `resource_id`, and the recipient's current email. The payload stores no email address, token, contract file, or signed Storage URL. The link is an application route. The rendered message has no per-attempt timestamp or attempt count.

Laravel deletes the `jobs` row when the handler returns. A dead worker leaves the row reserved. `reserved_at` is the lease. `retry_after` stays 90 seconds and stays longer than the Resend request timeout. After 8 tries the payload moves to `failed_jobs`. There is no `DELIVERED` status.

Run and restart the worker with `php artisan queue:work`. Inspect a failed send in `failed_jobs`. Do not retry a failed notification job the next day with the same key and expect Resend to dedupe it.

## Idempotent send

Gmail SMTP cannot dedupe a retry. Laravel's `Mail::` Resend transport cannot pass an idempotency key. Do not add `resend/resend-laravel` and do not use a Mailable for this send. The worker calls `resend/resend-php`:

`Resend::client($apiKey)->emails->send($payload, ['idempotency_key' => $eventKey])`.

- Key: `notifications.event_key`. Never a random UUID per attempt. Resend's limit is 256 characters.
- Same key and the same JSON body within 24 hours: Resend returns the original email id and does not send again.
- `409 concurrent_idempotent_requests`: release the job for a later try. Do not mint a new key. Laravel still counts that pickup toward the job's tries.
- `409 invalid_idempotent_request` (same key, different body): fail the job into `failed_jobs`. Do not mint a new key. A changed recipient email between tries is this case.
- Cap the job at 8 tries. Backoff is 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour, 2 hours, 4 hours, then 8 hours. That series ends inside the 24-hour window.

`NOTIFICATIONS_MAILER` is `log` or `resend`, separate from `MAIL_MAILER`. Fortify verification and password reset stay on `MAIL_MAILER=log`. Local and tests use a fake sender that records the key and sends nothing. A later provider is another implementation of the same send method only if it accepts an idempotency key.

## Backend deliverables

- [ ] Insert the inbox row and dispatch the deliver job in the same transaction as the domain write. Listing approve and reject use audience `OWNER`. Do not write `notification_outbox`.
- [ ] Deliver the email from the `jobs` row with `resend/resend-php` and the idempotency key above. Document `queue:work` restart and `failed_jobs`. Do not add a notification sweep.
- [ ] `GET /api/v1/notifications?audience=OWNER|TENANT|ADMIN` returns one page for the current user and that audience, plus `unread_count`. `POST /api/v1/notifications/{id}/read` sets `read_at` only when it is null. Another account receives 404. `audience=ADMIN` requires an admin and otherwise returns 403. Retain no tokens, private contracts, or contact payloads.

## Frontend deliverables

- [ ] Replace the owner and tenant coming-soon notification pages and add an admin inbox. Each page and badge requests only its audience. A listing notice links to the owner listing route, which checks access again.
- [ ] Clear held notification state when the account changes. Switching between the owner and tenant portals refetches the other audience and does not mix the lists.

## Acceptance criteria

- [ ] A running worker delivers a committed event once per recipient. Rollback writes no inbox row, no `jobs` row, and no `notification_outbox` row.
- [ ] A duplicate `event_key` for the same recipient does not create a second inbox row or a second job. A worker that dies after reserving the job leaves that row in `jobs`; it becomes available again after `retry_after` and still sends once.
- [ ] A second run of the same job, with the same key and the same body, is one provider outcome. `409 concurrent_idempotent_requests` releases the job. `409 invalid_idempotent_request` moves it to `failed_jobs` and keeps the key.
- [ ] Provider failure leaves the business row and the inbox row committed. Tries stay inside the 24-hour window, then the job is in `failed_jobs`.
- [ ] Only the recipient can list and mark read. A repeated read does not change `read_at`. An owner list does not include that user's tenant or admin rows. A non-admin requesting `ADMIN` receives 403.
- [ ] `queue:work` restart and `failed_jobs` inspection are documented with the commands and results that showed them. The specification is not that evidence.

## Tests/evidence owned by this member

- [ ] Unit tests for event mapping, payload redaction, link shape, and audience on the notification writer.
- [ ] PostgreSQL tests: rollback writes nothing; a duplicate `event_key` does not create a second inbox row; a second send with the same key is one fake-sender outcome; provider failure leaves the business row committed; only the recipient can list and read.
- [ ] Manual check of one delivered notification on the owner, tenant, and admin inboxes, including mark read, the other portal staying empty, and a different account after sign-out.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-04, NFR-05, NFR-06, NFR-07; T6a, T3g, T4d

Do not add Kafka/RabbitMQ or a separate queue platform to satisfy course async requirements. Scheduler-driven domain decisions remain in their owning feature actions. FR59 remains an M02 requirement and is not delivered here.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-10 is a planning key, not a GitHub number. Deleted issues are not reused.
