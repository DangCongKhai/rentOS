# Deployment and operations

Discover chosen provider first; document web frontend, Laravel API, persistent PostgreSQL/storage, long-running workers and scheduler as separate responsibilities even if deployed together. Use environment templates, HTTPS, allowed origins/redirects, restricted diagnostics, signed private downloads, safe migrations/seeds, queue restart and health checks. Record runbook for worker/scheduler outage, failed jobs, migrations and visibility/cache invalidation. Do not claim deployment/free tiers or production readiness without evidence.

Validation is part of feature/engineering issues and PR evidence. Tool versions/configuration must match the local installed framework; no invented pass result.


## Database and CI execution

Every member uses their own local Supabase and runs committed Laravel migrations/seeders. Application tables live in the existing `public` schema. Use a direct PostgreSQL migration endpoint when the runner can reach it, with SSL; explicitly document session-pooler fallback/network constraints. Do not silently run migrations through transaction pooling. Keep provider-managed auth/storage untouched.

Khai owns initial Sanctum/Scramble/Telescope and CI/CD setup in RNT-01. PR CI gets disposable PostgreSQL/Supabase and test credentials only; lint/static/type/build/unit/component/API checks must pass before reviewed main deployment. Serialize migration+matching code/worker release with cancel-in-progress=false. Never run hosted migrate:fresh/reset/demo reseeding. Test rebuild and prior-schema upgrade; provide failure/backup/restore and worker/scheduler runbooks. Additive changes/backfill precede destructive removal; run all API consumers’ tests on the integrated schema.


Primary implementation references: https://supabase.com/docs/guides/database/connecting-to-postgres and https://supabase.com/docs/guides/getting-started/quickstarts/laravel. Migrations use the existing `public` schema and a direct PostgreSQL connection when the runner can reach it. Provider connection details and installed Laravel configuration must be verified.

## Authentication deployment prerequisite

Use controlled sibling subdomains with HTTPS and exact credentialed CORS/stateful-host settings, or a deliberately tested same-origin proxy. Verify session/CSRF cookies, login/logout/reset links and no private caching. Configure Laravel mail, database sessions and expired-token/session pruning; Supabase Auth is not used. Follow [authentication setup](../07-architecture/authentication-setup.md).
