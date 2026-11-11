<!-- rentos-backlog-v2: RNT-03 -->

# RNT-03: Implement account forms, session login, CSRF protection and API-token settings

## Outcome

Users register, verify email, sign in and recover access through Fortify; Next.js uses Sanctum browser sessions with CSRF. Users separately create and revoke scoped personal API tokens in Settings > API tokens.

## Ownership and order

- Phase 1.
- Implementation: **Hien** (frontend + backend + own tests).
- Reviewer: **Kien**.
- Prerequisites: [RNT-01](RNT-01.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR01 — Email registration** (P0 Must): Register through Laravel Fortify. Create one users row with a normalized unique email, hashed password and is_admin=false. Confirm email before protected product writes or API-token creation. One user can rent and own; no phone OTP or role-selection step.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr01)
- **FR02 — Sign in with a Sanctum browser session** (P0 Must): Next.js obtains /sanctum/csrf-cookie and submits credentials to Fortify /login with cookies and X-XSRF-TOKEN. Regenerate the session ID on login. Sanctum authenticates subsequent browser API requests using the HttpOnly Laravel session cookie; login creates no personal API token. Unverified users have only the limited verification/account flow; expired sessions require sign-in.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr02)
- **FR04 — Sign out of the browser session** (P0 Must): CSRF-protected POST /logout invalidates the current Laravel browser session and regenerates its CSRF token. Clear/cancel private TanStack Query data. Ordinary logout does not revoke independently created personal API tokens; users revoke those in API tokens settings. Failed server logout is shown honestly. Password reset or account suspension invalidates all sessions and tokens.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr04)
- **FR05 — Enforce account and resource permissions** (P0 Must): Private routes require auth:sanctum and current account/ownership/participant/admin Policies. Browser requests use sessions and CSRF; approved token-enabled endpoints additionally enforce personal-token abilities. Sanctum tokenCan returns true for first-party sessions, so it never replaces Policies. Current users.is_admin is server-managed; personal API tokens cannot call admin or token-management routes.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr05)
- **FR06 — Profile and dual dashboards** (P0 Must): View/update permitted name and contact information and navigate between tenant area and Manage rentals. Phone is contact information, not verified ownership. Avatar/DOB are optional later scope.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr06)
- **FR43 — Protect APIs with Sanctum sessions and scoped tokens** (P0 Must): Use auth:sanctum for private APIs. Browser clients use Fortify sessions; non-browser clients may send an explicitly created Sanctum personal access token only on the documented token-enabled routes. Enforce active/verified account, token expiry/revocation, abilities and current resource Policies. Store token hashes only. Reject provider JWTs and remove the former identity-token exchange. FR89 owns token management; FR90 owns CSRF.
  - [All 8 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr43)
- **FR49 — Password reset and email confirmation** (P0 Must): Use Fortify/Laravel password-broker reset links and signed email-verification links with allowlisted frontend destinations, expiry and throttling. Store password/reset-token hashes only. After a successful password reset invalidate all browser sessions, remember credentials and personal API tokens; require fresh login. The reset handler uses the valid reset token, not an existing login. Configure Next.js reset/verify screens when Fortify views are disabled.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr49)
- **FR89 — Manage personal API tokens** (P0 Must): Provide Settings > API tokens with create, list and revoke actions. Creation requires a current browser session, recent password confirmation, CSRF, a name, allowed abilities and finite expiry. Initial abilities: account:read, favourites:read, favourites:write. Show plaintext once; persist only its hash and metadata. List name, abilities, created/last-used/expiry/status without secrets. Revoke immediately; rotation is explicit create replacement then revoke old. Tokens cannot mint/manage tokens or invoke admin APIs.
  - [All 8 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr89)
- **FR90 — Protect browser forms against CSRF** (P0 Must): Apply Laravel CSRF validation to browser POST/PUT/PATCH/DELETE forms and actions, including login, registration, password reset, logout, profile, favourites, rental/contract and admin actions. Next.js obtains the CSRF cookie and sends X-XSRF-TOKEN plus session cookies. Invalid/missing/mismatched CSRF fails before writes (419 on the selected Laravel baseline). Keep server validation and field errors. Genuine bearer-only non-browser calls on approved routes use token permissions instead of browser CSRF.
  - [All 6 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr90)

## Backend deliverables

- [ ] Implement Fortify registration/login/logout, signed email verification, password-broker recovery and current-user/profile APIs with users/profile atomic creation and normalized email uniqueness. Only Laravel owns passwords; keep is_admin server-controlled and verified/active-account checks current.
- [ ] Use auth:sanctum and Policies for private APIs. Browser writes use Laravel CSRF; enforce session-only mode for token management, admin and all private routes outside the approved PAT matrix. Do not infer authorization from tokenCan for first-party sessions.
- [ ] Implement GET/POST /api/v1/account/api-tokens and DELETE /api/v1/account/api-tokens/{id}, using browser-session-only authentication, verification, active-account checks and current-user scoping. Mutations require CSRF and recent password confirmation. Add form validation and rate limits.
- [ ] Allow only account:read, favourites:read and favourites:write; expose the mapping in OpenAPI. Validate token name and expiry choices 1/7/30 days (proposed configurable default 30). Return plaintext once on create with no-store, store SHA-256 hash, and list metadata only. Never cache a creation secret for idempotent replay.
- [ ] Revoke tokens by deleting the current user’s selected row. Ordinary browser logout invalidates only its session. Successful password reset/change or account suspension invalidates all sessions and PATs and rotates remember credentials; explicitly integrate these hooks rather than assuming Fortify does everything.
- [ ] Add audit events for token creation/revocation/security actions containing actor, token id, abilities, expiry and outcome only. Configure diagnostic/request redaction; schedule expired-token pruning. Real enforcement must reject expiry before pruning.
- [ ] Use Laravel mail/verification/reset routes with allowlisted Next.js URLs. With Fortify views disabled, configure password.reset URL generation and verification redirect; never reflect arbitrary return URLs. Reset redemption requires a valid reset token, not an existing browser login.

## Frontend deliverables

- [ ] Implement separate Next.js register/login/email-verification/forgot-password/reset-password/profile screens. Initialize CSRF before browser auth, use cookies and X-XSRF-TOKEN, show 422 field errors and 401/403/419/429 feedback. Keep tenant/owner navigation and normal-user admin denial.
- [ ] Add Settings > API tokens: name field, approved ability checkboxes, expiry selector, recent-password-confirmation form, one-time secret display/copy, and metadata list with revoke confirmation. Explain that logout does not revoke these tokens. Clear the one-time secret on leaving; do not persist it in localStorage or TanStack caches.
- [ ] Handle session expiry by clearing/cancelling account-private queries; retain safe unsent form input and ask for explicit resubmission after recovery. Do not automatically replay contract/favourite/other writes after an ambiguous network failure.
- [ ] Give a cookie-free curl/Postman example for /api/v1/me and favourites. Demonstrate read-only success, denied write, explicit revoke and subsequent 401; public listing access needs no token.

## Acceptance criteria

- [ ] Every FR01/02/04/05/43/49/89/90 acceptance specification is implemented and tested within its scope; one Laravel user/profile identity can both rent and own.
- [ ] Browser login regenerates its session and creates zero personal tokens. Protected browser forms succeed with matching CSRF and fail without/mismatched CSRF before data/audit/outbox mutation.
- [ ] Verified active users can create a named finite-lived allowed-scope PAT after recent password confirmation, see plaintext once, list metadata and revoke their own token. Foreign token IDs, wildcard/admin scopes and PAT-only management requests are denied.
- [ ] Cookie-free real bearer calls enforce the documented scope matrix, current account and resource Policies; expired/revoked tokens return 401, missing ability returns 403. Personal tokens cannot invoke admin or session-only routes.
- [ ] Ordinary logout invalidates the current browser session, while separately created PATs remain valid until explicit revocation/expiry. Reset or suspension invalidates all sessions/tokens; the UI states the difference.
- [ ] Localhost and deployed sibling-domain flows pass the configuration checks; 419 recovery does not silently duplicate writes. Tokens, hashes, cookies, CSRF values, passwords and reset links do not enter logs/Telescope/caches.
- [ ] Scramble documents session/CSRF and bearer paths separately. Evidence demonstrates the teacher’s CSRF/server-validation and Sanctum token-management/permission criteria without requiring an automated browser suite.

## Tests/evidence owned by this member

- [ ] Unit tests for normalized registration, validation, permitted scopes/expiry, account checks and token metadata serialization; frontend component tests for login, 419 recovery, create/copy-once/revoke and account switching.
- [ ] API/PostgreSQL tests for user/profile atomicity, real login session rotation/logout, valid/missing/mismatched CSRF, protected writes and role/resource denial. Explicitly disable the Laravel testing CSRF bypass in a dedicated harness; merely enabling middleware is insufficient.
- [ ] Real PAT issuance and cookie-free bearer tests for hash storage, ability denial, expiry, revocation, foreign token IDs, session-only routes, password-reset/suspension revocation and redaction. Do not substitute Sanctum::actingAs for all token integration tests.
- [ ] Manual screen and deployed-origin checks plus curl/Postman demonstration with both success and denied token operations; no mandatory E2E automation.

## NFRs, boundaries and coordination

NFR-02, NFR-03, NFR-04, NFR-06, NFR-07

Hien owns frontend + backend + tests for the complete account/token feature. Khai supplies initial Fortify/Sanctum/schema/CORS/client/Telescope setup in RNT-01. Admin account restrictions must call the shared session/token revocation service. Each feature owner applies CSRF and Policies; approved PAT endpoints are limited to current-user and favourites APIs.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-03 is a planning key, not a GitHub number. Deleted issues are not reused.
