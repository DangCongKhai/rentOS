<!-- rentos-backlog-v2: RNT-13 -->

# RNT-13: Verify contract permissions, conflicting updates and deployment failure recovery

## Outcome

Agreement flows survive hostile/stale/concurrent input, and reviewed merges migrate/deploy the same tested revision safely.

## Ownership and order

- Phase 4.
- Implementation: **Khai** (frontend + backend + own tests).
- Reviewer: **Kien**.
- Prerequisites: [RNT-09](RNT-09.md), [RNT-10](RNT-10.md), [RNT-12](RNT-12.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR05 — Enforce account and resource permissions** (P0 Must): Private routes require auth:sanctum and current account/ownership/participant/admin Policies. Browser requests use sessions and CSRF; approved token-enabled endpoints additionally enforce personal-token abilities. Sanctum tokenCan returns true for first-party sessions, so it never replaces Policies. Current users.is_admin is server-managed; personal API tokens cannot call admin or token-management routes.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr05)
- **FR33 — Enforce nonoverlapping unit rental periods** (P0 Must): PostgreSQL GiST exclusion constraint on tenancies(unit_id, daterange(blocked_start_date, blocked_end_date+1, [))) for PENDING_CONFIRMATION/CONFIRMED/ACTIVE. Different nonoverlapping future tenancies on one unit are permitted. Blocking envelope includes confirmed span plus any proposed renewal extension.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr33)
- **FR43 — Protect APIs with Sanctum sessions and scoped tokens** (P0 Must): Use auth:sanctum for private APIs. Browser clients use Fortify sessions; non-browser clients may send an explicitly created Sanctum personal access token only on the documented token-enabled routes. Enforce active/verified account, token expiry/revocation, abilities and current resource Policies. Store token hashes only. Reject provider JWTs and remove the former identity-token exchange. FR89 owns token management; FR90 owns CSRF.
  - [All 8 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr43)
- **FR74 — Idempotent writes and stale revisions** (P0 Must): Use client_operation_id UUID on creates and revision checks on mutable resources. Scope operation key to actor/parent. Reusing key with different canonical payload returns409; terminal action replay never repeats side effects.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr74)
- **FR75 — Transactional locking audit and consistency** (P0 Must): All writes use shared Laravel actions, fixed lock order property then units sorted by UUID then rental request/tenancy/renewal rows. Persist domain/audit/outbox/idempotency in same transaction. Direct clients cannot write application tables. Cross-table invariants use composite FKs and deferred constraint triggers as specified.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr75)
- **FR81 — Confirm the exact contract version mutually** (P0 Must): Both parties acknowledge the same tenancy_contracts.id and immutable document_sha256. owner_confirmed_at is set only through explicit owner submission; tenant_confirmed_at is set once by the related tenant before deadline on the current pending contract. Tenant may instead set tenant_rejected_at with reason, never both outcomes. The final confirmation promotes confirmed dates and clears the pending pointer/deadline atomically. A new contract version requires fresh confirmation fields.
  - [All 6 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr81)
- **FR84 — Reserve renewal extension without releasing current occupancy** (P0 Must): tenancies stores confirmed_start/end and blocked_start/end as transactional projections. Original unconfirmed proposal has only blocked dates. Confirmed tenancy with pending renewal expands blocked_end while confirmed_end stays unchanged. Decline/cancel/expiry restores blocked span to confirmed span; successful agreement promotes confirmed span.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr84)
- **FR86 — Enforce immutable contract terms and write-once confirmations** (P0 Must): Database triggers protect tenancy_contracts terms/document/hash from update/delete while permitting one authorized null-to-value tenant confirmation or rejection update. Existing confirmation timestamps and reasons cannot be overwritten. Composite FKs keep pending/latest/superseded/basis contract references in the same tenancy. Deferred invariant checks enforce exact-contract mutual confirmation, request outcomes and date projections. No separate confirmation table.
  - [All 5 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr86)
- **FR89 — Manage personal API tokens** (P0 Must): Provide Settings > API tokens with create, list and revoke actions. Creation requires a current browser session, recent password confirmation, CSRF, a name, allowed abilities and finite expiry. Initial abilities: account:read, favourites:read, favourites:write. Show plaintext once; persist only its hash and metadata. List name, abilities, created/last-used/expiry/status without secrets. Revoke immediately; rotation is explicit create replacement then revoke old. Tokens cannot mint/manage tokens or invoke admin APIs.
  - [All 8 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr89)
- **FR90 — Protect browser forms against CSRF** (P0 Must): Apply Laravel CSRF validation to browser POST/PUT/PATCH/DELETE forms and actions, including login, registration, password reset, logout, profile, favourites, rental/contract and admin actions. Next.js obtains the CSRF cookie and sends X-XSRF-TOKEN plus session cookies. Invalid/missing/mismatched CSRF fails before writes (419 on the selected Laravel baseline). Keep server validation and field errors. Genuine bearer-only non-browser calls on approved routes use token permissions instead of browser CSRF.
  - [All 6 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr90)

## Backend deliverables

- [ ] Close observed security/integrity defects across original and renewal APIs using real participant, hash, lock, revision and replay rules; review private storage/download grants and public Data API exposure.
- [ ] Verify Khai’s RNT-01 CI/CD to test schema rebuild plus upgrade of the prior state; merged deployment uses environment secrets, direct DB connectivity preflight, one database concurrency group with cancel-in-progress=false and migrate --force before matching app/worker deployment.
- [ ] Document compatible additive/backfill/remove releases, failed-migration recovery and backup/restore rehearsal in a disposable environment; do not assume batch-wide rollback or auto-run destructive resets.
- [ ] Verify private routes use Sanctum session or explicitly allowed PAT mode, current Policies and CSRF for browser mutations. Prove missing CSRF denial, session invalidation, token expiry/revocation and denial of PAT access to admin/session-only actions. Review no provider JWT bridge remains.

## Frontend deliverables

- [ ] Check account/session recovery, stale contract forms and participant-only contract links; fix confirmed errors with frontend component and API regression tests.
- [ ] Ensure old contract/history views and forms recover safely when a deployed API/schema changes compatibly.

## Acceptance criteria

- [ ] Targeted hostile, stale and concurrent contract tests pass without permitting hidden writes or mismatched acknowledgement.
- [ ] A PR test or migration failure prevents hosted deployment; production credentials are unavailable to PR test code.
- [ ] Two hosted deployment attempts cannot migrate concurrently or cancel a migration in progress.
- [ ] Hosted deployment runs only reviewed migrations and matching code; no migrate:fresh/reset/demo reseed occurs.
- [ ] A fresh setup and previous-schema upgrade both pass; backup/restore and migration failure recovery are documented with actual rehearsal evidence.
- [ ] Security fixes include backend and frontend regression tests and updated API documentation and response types.
- [ ] A missing/mismatched CSRF request cannot mutate domain data; revoked session/PAT replay fails after reset/suspension; real PAT read/write/admin denial evidence is recorded.

## Tests/evidence owned by this member

- [ ] Feature unit tests for any changed authorization/state logic plus frontend recovery components.
- [ ] Real PostgreSQL concurrency and upgrade tests, API negative tests and manual checks of owner/tenant contract screens.
- [ ] CI/deployment failure rehearsal, connection preflight and disposable restore evidence.
- [ ] Integrated CSRF/cookie/CORS tests with bypass disabled; real token scope/revocation and password-reset/suspension invalidation tests, plus manual deployed-origin verification.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-06, NFR-07

NFR-02, NFR-03, NFR-06, NFR-07; T1d, T2a, T3g, T4d, T4b
Do not postpone RNT-01/05/09 tests to this phase. This issue fixes integrated-release defects and proves the release process, rather than collecting untested code.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-13 is a planning key, not a GitHub number. Deleted issues are not reused.
