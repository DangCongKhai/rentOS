# Shared setup, API docs, monitoring, tests and release — PRD

## Outcome

Khai owns the complete initial engineering setup in RNT-01, including Sanctum, Scramble and Telescope. Each owner implements and tests their feature frontend/backend.

## Scope and screens/actions

- Local per-developer Supabase; complete Laravel migrations/seeders through direct PostgreSQL where reachable. Application tables live in the existing `public` schema.
- PR CI runs lint/type/build/unit/component/API/PostgreSQL checks. Reviewed main deploy serializes migrations and matching app/worker release; no hosted reset/reseed.
- Telescope setup/access/filtering/pruning is RNT-01; Tri implements diagnostics/correlation and actual alerts in RNT-12. TypeScript generator setup is documentation only; no mandatory E2E.

## Functional requirements

### FR44 — OpenAPI documentation

**Priority:** P1 Should. **Actors:** Developer. **Delivery:** Primary: RNT-01.

Scramble documents Fortify session/CSRF setup separately from Sanctum bearer tokens, the token-enabled endpoint/ability matrix, session-only routes and 401/403/419/422 failures. Include token creation/list/revocation, expiry, one-time secret response and redaction. Preserve payload, revision and idempotency documentation.

Acceptance: [3 cases for FR44](../../06-acceptance/test-scenarios.md#fr44); IDs FR44-AC01, FR44-AC02, FR44-AC03.

### FR47 — Structured logs and critical alerts

**Priority:** P1 Should. **Actors:** System; Developer. **Delivery:** Primary: RNT-12.

Log request/event ID, actor/resource UUIDs, operation and failure duration/context. Alert configured admin/developer on critical storage, transaction or exhausted job failures. Business audit remains separate.

Acceptance: [3 cases for FR47](../../06-acceptance/test-scenarios.md#fr47); IDs FR47-AC01, FR47-AC02, FR47-AC03.

### FR48 — Development monitoring and slow query alerts

**Priority:** P1 Should. **Actors:** Developer; authorized admin. **Delivery:** Primary: RNT-12.

Use Telescope in development with restricted access. Capture slow query duration and cumulative query time and configure explicit developer alert thresholds; Telescope display alone is not an alert.

Acceptance: [3 cases for FR48](../../06-acceptance/test-scenarios.md#fr48); IDs FR48-AC01, FR48-AC02, FR48-AC03.

### FR76 — Deferred and excluded MVP scope

**Priority:** P3 Exclude. **Actors:** Team. **Delivery:** Scope rule applied to all issues.

No phone OTP, property/image moderation, image replacement review, in-app viewing calendar, platform e-signature engine, payment collection, mid-term confirmed-contract amendment, Kafka/RabbitMQ, Elasticsearch or custom thumbnail AI in initial MVP. Laravel email confirmation remains required. Maps/Google sign-in/property reviews retain separately marked deferred priorities.

Acceptance: [3 cases for FR76](../../06-acceptance/test-scenarios.md#fr76); IDs FR76-AC01, FR76-AC02, FR76-AC03.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
