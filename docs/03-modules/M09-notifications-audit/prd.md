# Private notifications, audit history and queued delivery — PRD

## Outcome

Business audit history is committed with domain changes. A running worker delivers private notifications from committed events.

## Scope and screens/actions

- Transactional audit/outbox/replay outcome; rollback sends nothing. Deduplicated event/recipient keys and bounded retry/backoff.
- Private notification list/count/read/deep links reauthorize the target; logout clears account state.
- Scheduled deletion removes abandoned/unreferenced photo files only after retention; never delete referenced covers or immutable agreement files. No Kafka/RabbitMQ requirement.

## Functional requirements

### FR45 — Asynchronous domain notifications

**Priority:** P1 Should. **Actors:** System. **Delivery:** Primary: RNT-10.

Write one notifications row, including audience ADMIN, TENANT, or OWNER, and one database jobs row atomically with request/moderation/proposal/confirmation/renewal outcomes. Laravel queue workers deliver the email after commit, with retry and event deduplication. Use database-backed Laravel Queue on Supabase PostgreSQL for MVP; no Kafka/RabbitMQ or viewing reminders.

Acceptance: [4 cases for FR45](../../06-acceptance/test-scenarios.md#fr45); IDs FR45-AC01, FR45-AC02, FR45-AC03, FR45-AC04.

### FR73 — Private notification inbox

**Priority:** P1 Should. **Actors:** User. **Delivery:** Primary: RNT-10.

Persist event-keyed in-app messages with safe links; unread/read state per recipient. Email links navigate through authorized application routes, not permanent document URLs.

Acceptance: [3 cases for FR73](../../06-acceptance/test-scenarios.md#fr73); IDs FR73-AC01, FR73-AC02, FR73-AC03.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
