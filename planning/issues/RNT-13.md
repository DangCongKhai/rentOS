<!-- rentos-backlog-v2: RNT-13 -->

# RNT-13: Sanctum tokens, CSRF evidence, contract integrity verification

## Outcome

Non-browser API clients can use narrowly scoped Sanctum personal access tokens. Browser writes remain protected by CSRF. Agreement writes reject overlapping rental dates, stale or mismatched contract decisions, and attempts from nonparticipants. Frontend API types and domain calls are separated into focused modules.

## Course mapping

- Task 3(c): CSRF protection and server-side validation.
- Task 4(b): Sanctum token authentication and permissions.
- Task 3(g) and Task 4(d): unit and integration tests.
- Task 1(d): use the existing GitHub Workflow; deployment-pipeline expansion is not part of this issue.

## In scope

- [x] Split frontend HTTP/CSRF/localization, auth, tenancy, owner, notification, and token APIs into focused modules with separate type contracts; remove the unused `auth-api.ts` compatibility barrel.
- [x] Add personal token create/list/revoke using a signed-in browser session and CSRF, allowlisted abilities (`account:read,favourites:read,rental-requests:read`), and preset/custom/no-expiry options.
- [x] Show token plaintext only in the create response and once in the UI; store only the Sanctum hash and return metadata when listing tokens.
- [x] Reject PAT-only callers from token management, contract confirmation, and admin actions; enforce token abilities on supported API routes.
- [x] Record representative CSRF evidence: a browser mutation without CSRF returns 419 and does not write; an allowed bearer-token favourite write works without browser cookies or CSRF.
- [x] Allow scoped PAT reads of the authenticated tenant's rental-request list and detail; deny PAT writes such as submit and withdraw.
- [x] Verify overlap rejection, adjacent/available dates, one-time contract confirmation or rejection, and participant-only contract decisions with PostgreSQL feature tests.
- [x] Keep stale contract recovery as the current localized 409 response with manual reload; no automatic refresh flow.
- [x] Record full-suite command results and note the build-tool restriction encountered in this workspace.

## Explicitly out of scope

- Contract PDF upload or `document_path` user flows. Confirmation identifies the pending `tenancy_contracts.id` and its immutable database terms.
- A `notification_outbox` table. Existing notification delivery uses Laravel's database queue after commit.
- Automatic stale-form reload UX; the existing 409 response asks the user to reload.
- New deployment concurrency, hosted migration, backup/restore rehearsal, or prior-schema CI work. Existing project workflow remains the release baseline.

## Implementation notes

- Personal tokens use Sanctum's existing table and ability enforcement. A migration adds the rental-request read ability and makes `expires_at` nullable for non-expiring tokens. Revocation deletes the caller's token immediately; cross-user token IDs are not visible.
- Token management routes are authenticated with `auth:sanctum`; controller/request checks reject personal-token authentication so these operations remain browser-session-only. Creation requires an authenticated session and CSRF, without a password prompt.
- Browser mutations continue through the shared CSRF-aware frontend HTTP client. Bearer-only API calls use the approved route ability and do not need browser CSRF headers.
- Existing overlap, renewal, and contract behavior is verified through the application actions and PostgreSQL constraints. Defects should be fixed only when a behavior test demonstrates them.

## Evidence recorded

- Full backend command: `composer run test` — **311 tests passed, 2,968 assertions**. `composer run lint`, `composer run typecheck` (PHPStan, 0 errors), and `php artisan optimize` also passed.
- Full frontend checks: `npm run typecheck`, `npm test` (**42 Vitest + 13 admin-review tests passed**), and `npm run lint` — passed.
- Production frontend build: `npx next build --webpack` — passed and generated `/api-tokens` and `/api-tokens/new`. The default Turbopack build previously failed because its local worker could not bind a port (`Operation not permitted`); the webpack build is the successful production build evidence.

## Definition of done

- Scoped PATs can be created, listed, and revoked in Profile settings; plaintext is shown once, never stored or listed.
- Browser token-management writes require CSRF; unsupported abilities and past custom expiry dates are rejected. No-expiry tokens are supported and can be revoked from the list.
- PAT scope, expiry, revocation, session-only route denial, and admin/contract authorization behavior have feature-test evidence.
- Browser CSRF denial and bearer-only non-browser write behavior have feature-test evidence.
- Rental overlap and exact-contract decision behavior pass PostgreSQL integration tests.
- Frontend typecheck, tests, lint, and build pass; backend tests, lint, typecheck, and build pass.
- No commits are created as part of this work.


