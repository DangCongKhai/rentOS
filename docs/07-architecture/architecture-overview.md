# Architecture overview

| Boundary | Responsibility |
| --- | --- |
| Next.js | Public discovery and private owner/tenant/admin screens; forms, TanStack Query and credentialed browser API calls |
| Laravel Fortify | Registration, login/logout, password hashing/recovery and email verification; Next.js supplies UI |
| Laravel Sanctum | Session authentication for first-party browser requests; independent scoped personal tokens for approved non-browser routes |
| Laravel middleware/Policies | CSRF on browser mutations, account eligibility, resource/role permissions and PAT scope restrictions |
| Supabase PostgreSQL | Private Laravel identity/framework tables and rental domain constraints; direct Eloquent connection |
| Supabase Storage | Validated media and private immutable contracts; Laravel-authorized access |
| Queue/scheduler | Notifications, expiry/15-day actions, unreferenced photo deletion and framework pruning |
| Scramble/Telescope | API documentation and restricted diagnostics; Khai configures both in RNT-01 |

Controllers coordinate FormRequests, Policies, transactional actions and Resources. Shared actions enforce the same domain rules in HTTP and worker paths. Khai owns initial migrations; feature owners create later reviewed migrations and their own UI/API/tests.

See [authentication setup](authentication-setup.md) for hosts/cookies/CORS, routes, schema transition and tests. Supabase Auth and the former JWT exchange are removed from the target architecture. Existing repository implementation and installed versions have not been audited.
