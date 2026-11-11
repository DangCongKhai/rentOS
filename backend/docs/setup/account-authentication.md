# Account authentication setup

This setup uses Laravel Fortify for registration, login, logout, email verification and authenticated password updates. Sanctum authenticates the first-party Next.js browser through Laravel's session cookie. Personal API-token management is not part of these routes.

## Local environment

Use the separate Supabase project `RentOS-Test` for local app runs and feature tests. Do not use Docker/local PostgreSQL for the application database. Never use the shared `RentOS's Project` database for tests, seeders, or development migrations. `backend/.env.example` contains the Test host but no password; keep the Test password in ignored local `backend/.env` or a secure execution environment. Verify the active project/endpoint before any database write.

The current Test schema was aligned from Laravel migrations without copying application rows. See [database connection setup](database-connection.md). PHPUnit's `RefreshDatabase` can drop and recreate every application table in Test; run tests only when Test data is disposable. Never target `RentOS's Project`.

Set the frontend API origin in `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The backend's local defaults use `FRONTEND_URL=http://localhost:3000`, a single exact `CORS_ALLOWED_ORIGINS` value, and stateful domains for the Next.js origin. For deployment, configure exact frontend/API origins and a shared parent cookie domain over HTTPS; do not use wildcard credentialed CORS.

Configure a development SMTP mail catcher or a trusted mail transport to receive email-verification links. The mail log transport is not suitable for this flow because it writes the signed verification URL into application logs. Keep Telescope's Mail watcher disabled and retain request/query redaction for authentication data.

## Browser flow

1. The frontend calls `GET /sanctum/csrf-cookie` with credentials included.
2. It reads the `XSRF-TOKEN` cookie and sends it as `X-XSRF-TOKEN` on browser mutations, with `credentials: include` and `Accept: application/json`.
3. Fortify handles `POST /register`, `POST /login`, `POST /logout`, email verification/resend routes, and `PUT /user/password`.
4. Current-user profile is available at `GET /api/v1/me`; update only name/phone via `PATCH /api/v1/me`.
5. Login rotates the session ID. Logout invalidates that session. A successful password update rotates the remember token, deletes all database sessions and personal access tokens for the user, and logs out the current browser session.

Registration creates the user unverified and authenticates the browser so the same session can access the verification notice/resend and signed verification handler. Until email is verified, product writes should be protected by verified-account middleware. No password-reset email endpoint is enabled; only the authenticated password-change endpoint exists.

## API contract

| Method | Path                               | Access                                              | Purpose                                               |
| ------ | ---------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| GET    | `/sanctum/csrf-cookie`             | Guest/session                                       | Initialize browser CSRF cookie                        |
| POST   | `/register`                        | Guest + CSRF                                        | Register, then create a browser session               |
| POST   | `/login`                           | Guest + CSRF + throttle                             | Authenticate and rotate session ID                    |
| POST   | `/logout`                          | Browser session + CSRF                              | Invalidate current session                            |
| POST   | `/email/verification-notification` | Browser session + CSRF + throttle                   | Resend verification notice                            |
| GET    | `/email/verify/{id}/{hash}`        | Browser session + signed URL + throttle             | Verify email and redirect to allowlisted frontend URL |
| GET    | `/api/v1/me`                       | Sanctum browser session, or PAT with `account:read` | Return safe profile fields                            |
| PATCH  | `/api/v1/me`                       | Active browser session + CSRF; PAT-only denied      | Update name and optional phone                        |
| PUT    | `/user/password`                   | Browser session + CSRF                              | Change password after checking current password       |

Password-reset routes are disabled. The user profile response omits password, remember token, admin privilege and account status.

## Design reference

UI styling follows `design/design-system.md`, `design/ui-ux-guidelines.md`, `design/brand-guidelines.md`, and `design/tokens/rentos-tokens.css`. The connected Figma file “rentOS Design - MAIN” was inspected: sign-in is frame `196:1040` (“rentOS · Sign in”) and registration is `196:1119` (“rentOS · Create account”). These frames include a shared dark navigation/footer and a split card with a residential photo panel beside the account form. The login and registration pages now use that split layout, shared navigation/footer, responsive stacking, and the repository logo/tokens. The repository does not contain the residential image asset, so the left panel uses a brand-colored CSS illustration rather than the Figma photograph; exact pixel parity and profile/verification/password-change frames were not verified. Google sign-in and password recovery links shown in the Figma sign-in screen are not implemented because they are outside the approved scope.

## Review notes (25 October 2026)

Profile reads require an active account; bearer reads also require `account:read`, as specified by the architecture matrix. Profile writes require an active `web` session and only copy `name`/`phone`, including when prohibited fields are sent as null. Private client requests use `cache: no-store`. Password updates recheck the current hash under a user row lock, and the logout listener is registered once through Laravel event discovery.

With headless Fortify, a signed verification link opened without a session redirects to the frontend sign-in page. After signing in, reopen the original email link. JSON requests still receive 401. The initial CSRF endpoint returns 204, not 200.

The review's read-only preflight found the effective local PHPUnit target `127.0.0.1:5432/rentos_test`, with `DB_SEARCH_PATH=public`, but the connection was refused. No feature tests, migrations or seeds were run. Start/configure that isolated PostgreSQL instance, verify the effective endpoint and server identity/search path again, then run `php artisan test --compact tests/Feature/AccountAuthFlowsTest.php`. The expanded tests are pending execution, including CSRF, scope denial, verification, throttling and revocation. Do not substitute the shared project.
