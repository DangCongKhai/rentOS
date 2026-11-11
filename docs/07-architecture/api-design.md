# API design

Endpoint names below are proposed contracts, not an audit of existing routes. Inspect the actual route list and align names without changing approved semantics.

## Authentication and authorization

Fortify supplies register/login/logout/reset/verification routes. Next.js initializes `/sanctum/csrf-cookie` and uses session cookies plus `X-XSRF-TOKEN` on mutations. Browser login creates no API token. Separate session-only token management lives at `/api/v1/account/api-tokens`; see [setup and endpoint/ability matrix](authentication-setup.md).

Only GET `/api/v1/me` and GET/PUT/DELETE favourite-properties routes initially accept personal bearer tokens with the corresponding allowed ability. Other private product routes, admin actions and token management are session-only. All private access requires current account/resource Policies. Public GET routes remain public.

| Resource/actions | Visibility | Representative contract |
| --- | --- | --- |
| GET listings/listing detail/amenities | Public safe fields | Location/date/filter/page query; one-unit full-interval qualification; canonical amenity keys |
| Properties/units/photos/listing draft/submit/publish/hide/archive | Owner only | Separate property and listing actions; validation, expected revision and client operation UUID where specified |
| Favourite-properties PUT/DELETE/list/count | Current user only | Property identity; first PUT 201/repeat 200; repeated DELETE 204; generic hidden placeholder |
| Rental requests submit/list/withdraw/reject | Own tenant/owner scope | Contact snapshots and complete desired dates; no standalone Accept |
| Tenancy proposal/contract confirm/decline/correct/move-in/end/cancel | Participants with action permission | Exact current version UUID/hash, deadline and transaction; 409 stale/overlap |
| Renewal request/proposal/confirmation | Participants | Pending negotiation; consecutive segment; extension reservation; no replacement of old agreements |
| Admin review/report/suspend/restore | Current admin browser session + Policy | Reasoned exact-revision decision; suspension independent of owner publication |
| Notifications/read and private document download | Authorized recipient/participant | Reauthorize target; no sensitive payload in public cache/logs |

## Input/output and failure rules

Use FormRequests for allowed fields, Policies for resource scope, Resources for explicit JSON serialization and documented collection pagination. Never expose whole database rows as DTOs. Use 401 for unauthenticated/expired/revoked credentials, 403 for permission denial (or documented non-disclosing 404), 404 for absent/nonpublic targets, 409 for stale state/revision/overlap/replay payload conflicts 419 for browser CSRF/session-token mismatch and 422 for input validation. Never return raw SQL/stack/token contents.

Create/retry keys are scoped to actor/action/parent and canonical payload. A key reused with another payload fails 409. Capture business/audit/outbox/replay results atomically; do not re-send side effects on terminal replay. Revision conflict requires a reload/review rather than blind last-write-wins. Client-side disabling alone is not concurrency protection.

## Caching: browser versus Laravel

TanStack Query caches each browser’s requests. Example query keys: `['listings', filters]`, `['listing', listingId]`, `['favourites', userId]`. Filters include location, dates, selected unit filters and page. After a successful relevant mutation, invalidate the browser’s affected detail/list queries. This does not invalidate another visitor’s browser or Laravel’s cache.

RNT-11’s finalized server-cache work remains in scope. Keep it bounded: cache reusable safe public listing content/search results with complete filter/date/page keys; invalidate affected detail/search entries (or a documented coarse search generation) after committed publish/hide/archive/suspend/edit and allocation changes. Use the agreed Laravel database cache initially; do not add Redis solely to fulfill this task. Measure the selected query before/after and name the cached endpoints/keys/TTL in the implementation PR.

Before returning cached public data, run a current publication/approval/suspension/archive visibility gate; reject stale revisions or recompute changed content as necessary. Search availability/counts remain derived from current qualifying units, and proposal creation always rechecks under database locks. The visibility check may still hit PostgreSQL: caching avoids rebuilding expensive data, not all database reads. A stale complete CDN response must not bypass that gate; avoid adding CDN/Next persistent caching until its invalidation and privacy behavior is explicitly designed.

Example: owner changes rent 5M→6M. Laravel invalidates old public data after commit; the owner’s browser invalidates its listing/detail searches. Example: admin suspends a listing. Subsequent Laravel reads deny it even if descriptive content was cached. A visitor who already downloaded it may see that old UI until refetch/navigation/focus/polling; do not promise instant removal from every open page without a specified push mechanism.

Keep tenant contacts/favourites/contracts in separate authenticated, account-private responses. Do not put per-user is_favourite or contract links inside a shared public response cache. User-specific browser keys are cache separation, never authorization. Clear/cancel prior-account private queries on sign-out/switch; use private/no-store HTTP behavior where sensitive responses must not be retained. Test hidden visibility, stale cache, account switching and failed mutation recovery.

## Future TypeScript generation — documentation only

Migrations define persistence; they cannot infer nested/conditional/computed Resource JSON. Current code maintains explicit frontend response types plus serialization/API tests and normal TypeScript checking. Future option: Resources/FormRequests/model casts → Scramble OpenAPI → openapi-typescript. Proposed commands (adapt paths and versions):

```bash
# Future only, from backend/
php artisan scramble:export --path=../contracts/openapi.json
# Future only, from frontend/
npx openapi-typescript ../contracts/openapi.json -o src/generated/api.d.ts
```

If adopted later, inspect inference gaps/nullability/date/decimal/JSONB/pagination, commit deterministic output and add drift checks. Do not install/configure/run the TypeScript generator or require generated artifacts now. Spatie’s transformer is a DTO/class-type approach, not a migration-to-HTTP-response generator; creating duplicate DTOs solely for generation is not required.

## Primary references

- https://laravel.com/docs/12.x/sanctum
- https://laravel.com/docs/12.x/cache
- https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
- https://scramble.dedoc.co/usage/response
- https://scramble.dedoc.co/usage/export
- https://openapi-ts.dev/introduction

Verify installed versions before applying framework-specific commands. The session/PAT separation, scopes, cache boundaries and product rules above are project design decisions, not claimed defaults of those libraries.
