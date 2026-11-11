# Identity, profiles and API permissions — PRD

## Outcome

Laravel Fortify owns account credentials and email flows. Next.js uses Sanctum session authentication with CSRF-protected forms. Users separately manage personal API tokens for the approved non-browser endpoints.

## Scope and screens/actions

- Registration, login, email verification, forgot/reset password, profile and tenant/owner navigation.
- Settings > API tokens: recent password confirmation, name, scope checkboxes, expiry, one-time display, metadata list and revoke.
- Session-only admin and token-management routes; current Policies enforce roles and resource access in both authentication modes.

## Functional requirements

### FR01 — Email registration

**Priority:** P0 Must. **Actors:** Guest. **Delivery:** Primary: RNT-03.

Register through Laravel Fortify. Create one users row with a normalized unique email, hashed password and is_admin=false. Confirm email before protected product writes or API-token creation. One user can rent and own; no phone OTP or role-selection step.

Acceptance: [4 cases for FR01](../../06-acceptance/test-scenarios.md#fr01); IDs FR01-AC01, FR01-AC02, FR01-AC03, FR01-AC04.

### FR02 — Sign in with a Sanctum browser session

**Priority:** P0 Must. **Actors:** User. **Delivery:** Primary: RNT-03.

Next.js obtains /sanctum/csrf-cookie and submits credentials to Fortify /login with cookies and X-XSRF-TOKEN. Regenerate the session ID on login. Sanctum authenticates subsequent browser API requests using the HttpOnly Laravel session cookie; login creates no personal API token. Unverified users have only the limited verification/account flow; expired sessions require sign-in.

Acceptance: [4 cases for FR02](../../06-acceptance/test-scenarios.md#fr02); IDs FR02-AC01, FR02-AC02, FR02-AC03, FR02-AC04.

### FR03 — Google sign in

**Priority:** P2 Defer. **Actors:** User. **Delivery:** Deferred — no MVP implementation.

Deferred Google sign-in may use Laravel Socialite and an explicitly verified account-linking flow to the existing Laravel users/profile UUID. It must not silently link accounts using an unverified email or reintroduce a separate identity store. No Google OAuth implementation in MVP.

Acceptance: [3 cases for FR03](../../06-acceptance/test-scenarios.md#fr03); IDs FR03-AC01, FR03-AC02, FR03-AC03.

### FR04 — Sign out of the browser session

**Priority:** P0 Must. **Actors:** User. **Delivery:** Primary: RNT-03.

CSRF-protected POST /logout invalidates the current Laravel browser session and regenerates its CSRF token. Clear/cancel private TanStack Query data. Ordinary logout does not revoke independently created personal API tokens; users revoke those in API tokens settings. Failed server logout is shown honestly. Password reset or account suspension invalidates all sessions and tokens.

Acceptance: [3 cases for FR04](../../06-acceptance/test-scenarios.md#fr04); IDs FR04-AC01, FR04-AC02, FR04-AC03.

### FR05 — Enforce account and resource permissions

**Priority:** P0 Must. **Actors:** User; Admin. **Delivery:** Primary: RNT-03.

Private routes require auth:sanctum and current account/ownership/participant/admin Policies. Browser requests use sessions and CSRF; approved token-enabled endpoints additionally enforce personal-token abilities. Sanctum tokenCan returns true for first-party sessions, so it never replaces Policies. Current users.is_admin is server-managed; personal API tokens cannot call admin or token-management routes.

Acceptance: [4 cases for FR05](../../06-acceptance/test-scenarios.md#fr05); IDs FR05-AC01, FR05-AC02, FR05-AC03, FR05-AC04.

### FR06 — Profile and dual dashboards

**Priority:** P0 Must. **Actors:** User. **Delivery:** Primary: RNT-03.

View/update permitted name and contact information and navigate between tenant area and Manage rentals. Phone is contact information, not verified ownership. Avatar/DOB are optional later scope.

Acceptance: [3 cases for FR06](../../06-acceptance/test-scenarios.md#fr06); IDs FR06-AC01, FR06-AC02, FR06-AC03.

### FR43 — Protect APIs with Sanctum sessions and scoped tokens

**Priority:** P0 Must. **Actors:** API client. **Delivery:** Primary: RNT-03.

Use auth:sanctum for private APIs. Browser clients use Fortify sessions; non-browser clients may send an explicitly created Sanctum personal access token only on the documented token-enabled routes. Enforce active/verified account, token expiry/revocation, abilities and current resource Policies. Store token hashes only. Reject provider JWTs and remove the former identity-token exchange. FR89 owns token management; FR90 owns CSRF.

Acceptance: [8 cases for FR43](../../06-acceptance/test-scenarios.md#fr43); IDs FR43-AC01, FR43-AC02, FR43-AC03, FR43-AC04, FR43-AC05, FR43-AC06, FR43-AC07, FR43-AC08.

### FR49 — Password reset and email confirmation

**Priority:** P0 Must. **Actors:** User. **Delivery:** Primary: RNT-03.

Use Fortify/Laravel password-broker reset links and signed email-verification links with allowlisted frontend destinations, expiry and throttling. Store password/reset-token hashes only. After a successful password reset invalidate all browser sessions, remember credentials and personal API tokens; require fresh login. The reset handler uses the valid reset token, not an existing login. Configure Next.js reset/verify screens when Fortify views are disabled.

Acceptance: [3 cases for FR49](../../06-acceptance/test-scenarios.md#fr49); IDs FR49-AC01, FR49-AC02, FR49-AC03.

### FR89 — Manage personal API tokens

**Priority:** P0 Must. **Actors:** Signed-in verified user. **Delivery:** Primary: RNT-03.

Provide Settings > API tokens with create, list and revoke actions. Creation requires a current browser session, recent password confirmation, CSRF, a name, allowed abilities and finite expiry. Initial abilities: account:read, favourites:read, favourites:write. Show plaintext once; persist only its hash and metadata. List name, abilities, created/last-used/expiry/status without secrets. Revoke immediately; rotation is explicit create replacement then revoke old. Tokens cannot mint/manage tokens or invoke admin APIs.

Acceptance: [8 cases for FR89](../../06-acceptance/test-scenarios.md#fr89); IDs FR89-AC01, FR89-AC02, FR89-AC03, FR89-AC04, FR89-AC05, FR89-AC06, FR89-AC07, FR89-AC08.

### FR90 — Protect browser forms against CSRF

**Priority:** P0 Must. **Actors:** Guest; signed-in user. **Delivery:** Primary: RNT-03.

Apply Laravel CSRF validation to browser POST/PUT/PATCH/DELETE forms and actions, including login, registration, password reset, logout, profile, favourites, rental/contract and admin actions. Next.js obtains the CSRF cookie and sends X-XSRF-TOKEN plus session cookies. Invalid/missing/mismatched CSRF fails before writes (419 on the selected Laravel baseline). Keep server validation and field errors. Genuine bearer-only non-browser calls on approved routes use token permissions instead of browser CSRF.

Acceptance: [6 cases for FR90](../../06-acceptance/test-scenarios.md#fr90); IDs FR90-AC01, FR90-AC02, FR90-AC03, FR90-AC04, FR90-AC05, FR90-AC06.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
