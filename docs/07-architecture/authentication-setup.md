# Fortify, Sanctum sessions and personal API tokens

Decision date: 23 October 2026. RNT-01/Khai owns shared setup; RNT-03/Hien owns forms, account/token APIs and their tests. This guide specifies the target implementation; it does not claim packages/routes already exist. Check the repository’s installed Laravel version before using these Laravel 12-style examples. Do not upgrade unrelated dependencies merely to match this guide.

## Two authentication modes

| Client | How it signs in | Credential on private requests | CSRF |
| --- | --- | --- | --- |
| Next.js browser | Fortify `/login` | HttpOnly Laravel session cookie | Required on POST/PUT/PATCH/DELETE |
| Postman or user script | User creates a PAT in account settings | `Authorization: Bearer <personal-token>` | No browser CSRF for genuinely cookie-free calls on approved token-enabled routes |

Fortify supplies registration/login/reset/verification behavior. Sanctum authenticates sessions or personal tokens. Laravel CSRF middleware protects the browser forms. Supabase provides PostgreSQL and Storage; Supabase Auth/JWKS and the old token-exchange endpoint are removed.

Do not create a token during browser login, store a login token in localStorage, or use a personal token as a workaround for a broken CSRF/cookie setup. Token management is a separate user action.

## 1. Establish the schema and packages

Migrate into the existing `public` schema. Use the agreed direct Supabase PostgreSQL connection for reviewed migrations. Keep runtime and deployment credentials separate. Do not use Supabase Auth.

Create one `users` row with a UUID primary key, name, normalized unique email, password hash, email verification time, phone, server-managed `is_admin`, `account_status`, and the framework timestamps and remember field. Register the Laravel `User` Authenticatable model as the provider; implement `MustVerifyEmail`, UUID behavior, `Notifiable` and `HasApiTokens`, and hide password/remember credentials in serialization. Do not return the whole model as `/me`.

Create `sessions` with nullable UUID `user_id` (guest CSRF sessions exist), `password_reset_tokens` and Sanctum `personal_access_tokens` with UUID-compatible `tokenable_id` referring to User. The morph association is not an automatic PostgreSQL FK: restrict its model/type and explicitly enforce integrity/deletion. See the [dictionary](data-dictionary.md).

Typical commands, only after checking whether installation/publication already happened:

```bash
composer require laravel/fortify
php artisan fortify:install
php artisan install:api
php artisan route:list
```

Inspect published migrations before executing them: consolidate duplicate users/session/token tables and apply UUID changes before first migration. Later changes need new migrations; do not rewrite migrations already used by teammates. RNT-01 also retains Scramble/Telescope, seeds, CI and the TypeScript-strategy documentation.

## 2. Configure Fortify and middleware

Use `web` as Fortify’s session guard and set `views => false` because Next.js renders forms. Enable registration, reset-password and email-verification features. Keep authentication POST routes in the `web` middleware group with CSRF. Configure Laravel’s User provider/password broker to the private-schema tables. Use `SESSION_DRIVER=database`; do not add a separate NextAuth/Supabase login layer.

In Laravel 12-style `bootstrap/app.php`, merge with existing middleware configuration:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->statefulApi();
    $middleware->alias([
        'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
        'ability' => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class,
    ]);
})
```

Import `Illuminate\Foundation\Configuration\Middleware`. Do not add `api/*`, login, register or token-management endpoints to CSRF exceptions. Account/verified/Policy checks and the project’s session-only middleware remain necessary; `auth:sanctum` alone accepts both modes.

Implement a session-only check for endpoints excluded from the PAT matrix: require an authenticated `web` session, not merely a successful `auth:sanctum` result. Apply it to admin, token management and all other private routes by default. A PAT belonging to an admin is still not accepted on those routes.

## 3. Configure domains, cookies and CORS

Use these example domains only as placeholders for domains the team controls:

| Setting | Local | Deployment |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | `https://app.example.com` |
| `APP_URL` | `http://localhost:8000` | `https://api.example.com` |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:3000,localhost:8000` | `app.example.com,api.example.com` |
| `SESSION_DOMAIN` | `null` (host-only localhost) | `.example.com` |
| `SESSION_SECURE_COOKIE` | `false` for local HTTP only | `true` |
| `SESSION_HTTP_ONLY` | `true` | `true` |
| `SESSION_SAME_SITE` | `lax` | `lax` |
| `SESSION_DRIVER` | `database` | `database` |
| `SESSION_LIFETIME` | `120` | `120` (proposed configurable minutes) |

Do not mix localhost and 127.0.0.1 between client/server URLs. Stateful domains contain host/port, without scheme. CORS allowed origins contain the exact scheme/host/port. Set `supports_credentials=true`, allow the chosen frontend origin, needed methods and headers (`Content-Type`, `Accept`, `X-XSRF-TOKEN`, `X-Requested-With`, and Authorization for permitted clients). Never use `*` as a credentialed allowed origin.

Apply CORS to `api/*`, `sanctum/csrf-cookie` and the actual Fortify authentication/reset/password-confirmation/email-verification paths. Use the installed route list to include them; configuring only `api/*` misses `/login`. Keep the session cookie HttpOnly. `XSRF-TOKEN` is intentionally readable so the client can send the header; it is not the authentication credential.

Unrelated Vercel/Railway default domains are not the recommended cookie deployment. Use sibling subdomains under one controlled parent domain, or implement and test a same-origin reverse proxy. A proxy must preserve Set-Cookie, Origin/host behavior, session/CSRF handling and no-store responses; it is not a transparent fix by itself. Do not broadly trust all hosted preview domains.

## 4. Browser request sequence

Browser components can call Laravel directly; TanStack Query wraps this client. Next.js App Router pages can still use this session approach. Server rendering/proxying is optional and requires explicit cookie forwarding and private-response handling, not automatic global login state.

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
});

// In the browser, before login/registration/reset form submission:
await api.get('/sanctum/csrf-cookie');
await api.post('/login', { email, password });
const me = await api.get('/api/v1/me');

// Subsequent browser mutations include session cookies and X-XSRF-TOKEN.
await api.patch('/api/v1/profile', { name, phone });
await api.post('/logout');
```

Axios versions must support the documented XSRF options. If using fetch, use `credentials: 'include'` and explicitly send the URL-decoded XSRF cookie in `X-XSRF-TOKEN`; fetch does not copy that cookie into a header automatically. Never send `document.cookie` wholesale as a header.

Login regenerates the session ID. Logout invalidates the current session, regenerates CSRF and clears/cancels private queries. On 401/419, show recovery feedback; preserve safe input, refresh CSRF/login as needed and require explicit resubmission. Do not silently repeat contract submissions or other writes after an ambiguous response.

## 5. Recovery and email verification

Configure mail in local/staging/production. Fortify’s headless setup still needs a valid named `password.reset` route or an explicitly customized Laravel reset URL pointing to an allowlisted Next.js page. The page submits token/email/new password to the broker-backed `/reset-password` with normal CSRF initialization. Possession of a valid reset token replaces the need for an existing login; do not protect reset redemption with a logged-in-only guard.

Verification links are Laravel-signed, expiring and tied to the intended user/email. Provide an allowlisted return to Next.js and a useful login step if needed. An unverified session can access only the minimal account/verification/logout flow, not private rental data, product writes or token creation. Avoid logging reset links or putting them in analytics.

Customize reset/change-password and suspension handling to revoke all database sessions and PATs and rotate remember credentials. Do not assume installing Fortify automatically revokes Sanctum tokens. Re-enabling an account never restores deleted credentials. Remember-me is disabled for the initial implementation; supporting it later needs explicit lifetime/revocation tests.

## 6. Settings > API tokens

UI: name, ability checkboxes, expiry choice, password confirmation, Create, one-time token/copy display, metadata list and Revoke confirmation. Metadata includes name, scopes, created time, last-used time, expiry and computed active/expired state. Revoked rows can disappear after deletion; audit records preserve nonsecret revocation history.

Management contracts are proposed route names:

| Method/path | Rules |
| --- | --- |
| GET `/api/v1/account/api-tokens` | Browser session only; verified active user; current-user metadata only |
| POST `/api/v1/account/api-tokens` | Same plus CSRF, password confirmation within 15 minutes, validation and throttle |
| DELETE `/api/v1/account/api-tokens/{id}` | Same mutation guards; current-user-scoped lookup; 404 for foreign id |
| POST `/user/confirm-password` | Fortify password confirmation; browser session and CSRF |

Recent-password timeout of 15 minutes and token-expiry choices 1/7/30 days (default 30) are proposed configurable project defaults. Validate name length 1–100 and at least one allowed ability. No wildcard, admin or token-management ability. Use `$user->createToken($name, $allowedAbilities, $expiresAt)` only after server validation, and return `plainTextToken` once with `Cache-Control: no-store`. Persist only the Sanctum hash. Do not place the secret in idempotency response storage, audit logs, Telescope or browser persistent storage.

A lost creation response cannot be recovered from a stored secret. The UI refreshes metadata, permits revocation of the inaccessible token and allows explicit new creation. Rotation is create replacement then revoke old; Sanctum PATs have no OAuth-style refresh token. Ordinary browser logout does not revoke PATs. Expiry enforcement works before pruning; schedule `sanctum:prune-expired` separately.

## 7. Approved personal-token API surface

These three abilities are the initial small implementation scope. They exercise real read/write permissions without exposing contract/admin actions to scripts. Expanding the surface later requires explicit API documentation and tests.

| Method/path | Required PAT ability | Resource rule |
| --- | --- | --- |
| GET `/api/v1/me` | `account:read` | Current user safe profile only |
| GET `/api/v1/favourite-properties` | `favourites:read` | Current user’s favourites and permitted placeholders |
| PUT `/api/v1/favourite-properties/{property}` | `favourites:write` | Save for current user; validate eligible property |
| DELETE `/api/v1/favourite-properties/{property}` | `favourites:write` | Remove only current user’s saved relation |

Browser sessions can use these routes too, with CSRF on mutations and Policies. Sanctum’s first-party `tokenCan` result is not a role/ownership check. PAT-only requests on every other private route return 403 for unsupported credential mode, even when owned by an admin. Public listing GET routes stay public.

Demonstrate with a cookie-free client; otherwise an existing session can mask a missing token ability because Sanctum prefers the session:

```bash
# TOKEN is supplied by the user in a local shell; do not commit or log it.
curl -H 'Accept: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/v1/me
```

Check account:read success, favourites:read success, read-only write denial (403), then revoke and verify 401. Account status/verification and ownership Policies apply every time. Newly authenticated requests observe committed revocation; already-authorized in-flight requests are not magically cancelled.

## 8. Existing-data transition and tests

For a fresh local project, use new Laravel users/profile seeds. If real prior data exists, back up and test an additive migration preserving identity UUIDs and domain references. Create Laravel users from verified migration data, replace profile’s old Auth FK only after integrity checks, and use a secure password-reset/reverification procedure where credentials cannot be migrated. Never blindly copy provider password hashes. Disable the old identity exchange and invalidate old PATs/provider credentials at cutover. Do not delete provider tables or rental records as part of a routine schema migration.

Required evidence: real session login/logout; no PAT created by login; valid/missing/mismatched CSRF on authentication and representative product mutations; zero writes after denial; real cookie-free PAT scopes/hash/expiry/revoke; session-only admin/token-management denial; password-reset/suspension invalidation; exact local/deployed origins; no secret leakage. CSRF middleware is bypassed by Laravel’s normal test environment: explicitly turn that bypass off in a dedicated harness or use an isolated HTTP integration process with CSRF enabled. `withMiddleware()` alone is not proof. No automated browser/E2E suite is required.

## Official references

- [Fortify](https://laravel.com/docs/12.x/fortify): headless account routes and reset-page configuration.
- [Sanctum](https://laravel.com/docs/12.x/sanctum): SPA sessions, same-parent-domain configuration, CSRF client options, tokens/abilities and expiry/revocation.
- [CSRF](https://laravel.com/docs/12.x/csrf): middleware/header checks and the automatic testing bypass.

These references describe framework behavior; chosen scope names, timeouts, route names and ownership are rentOS design decisions.
