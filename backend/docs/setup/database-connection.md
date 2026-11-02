# Database connection and migration workflow

rentOS uses PostgreSQL. Supabase supplies PostgreSQL and Storage only; Laravel owns the application tables and migrations. Those tables belong in the existing `public` schema. Supabase already creates `public`. Do not create a separate `laravel` schema.

`DB_SEARCH_PATH=public` tells Laravel where unqualified migrations create tables. `public` already exists, so the first step is `php artisan migrate`.

## Prerequisites and installation

From `backend/`:

```bash
php -v
composer -V
php -r "exit(extension_loaded('pdo_pgsql') ? 0 : 1);"
psql --version
composer install
cp .env.example .env
php artisan key:generate
```

The extension check exits successfully only when `pdo_pgsql` is enabled. Install PostgreSQL client tools and the PHP PostgreSQL extension for the active PHP version if either preflight fails. The Supabase CLI is additionally required for the local Supabase option:

```bash
supabase --version
supabase start
supabase status
```

Do not commit `.env`, database passwords, connection strings, or Supabase service credentials.

## Connection profiles

Use explicit `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` values. Do not replace them with `DB_URL`; explicit fields make endpoint and pooler selection reviewable.

### Direct remote Supabase connection

Copy the direct connection parameters from **Supabase Dashboard → Connect → Direct connection**:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=db.<project-ref>.supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=<database-password>
DB_SSLMODE=require
DB_SEARCH_PATH=public
```

This is the canonical migration connection when the machine or runner can reach the direct endpoint. Supabase direct endpoints may require IPv6. Use deployment credentials for reviewed migrations and separate least-privilege runtime credentials for the deployed application; do not expose either credential to the frontend.

### Local Supabase

Run `supabase status` and use the PostgreSQL values it reports. A default local installation normally uses:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=54322
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_SSLMODE=disable
DB_SEARCH_PATH=public
```

Treat the output of `supabase status` as authoritative if it differs. Each teammate should use an isolated local stack.

### Personal hosted Supabase project

A personal hosted project is an acceptable isolated-development alternative when local Supabase is unavailable. Use that project's **direct connection** values, `DB_SSLMODE=require`, and `DB_SEARCH_PATH=public`. Never point local destructive commands or demo seeders at a shared project.

## Check the connection

Configure `.env` for the isolated or deployment connection, then confirm Laravel is looking at `public`:

```bash
php artisan config:clear
php artisan config:show database.default
php artisan config:show database.connections.pgsql
```

The configuration output should resolve to `pgsql`, the intended endpoint, `sslmode`, and `search_path: public`. Stop if the endpoint is shared or production when you intended local development. Do not create another schema and do not revoke privileges on `public`. Supabase uses `public` for application tables and keeps its own objects in schemas such as `auth` and `storage`.

## Migration and seed flow

Workstream 2A provides the baseline schema migrations. Workstream 2B provides optional deterministic database and real media fixtures for isolated non-production environments.

For an isolated local Supabase or personal development project, after reviewing the migration files:

```bash
php artisan config:clear
php artisan migrate:status
php artisan migrate --pretend
php artisan migrate
php artisan migrate:status
```

After migrations, use the [two-part media fixture guide](media-fixtures.md): Part A upserts the stable database rows, and Part B uploads the exact committed images to the configured public Supabase Storage bucket. The baseline seeder blocks production and never deletes arbitrary existing data.

For disposable local/test databases, a schema-only full rebuild is allowed only after confirming isolation:

```bash
php artisan migrate:fresh
```

Never run `migrate:fresh`, `db:wipe`, migration resets/refreshes, or reseed a shared, staging, or production database.

## Upgrade flow

Treat an existing shared or production database as forward-only:

1. Take and verify a provider backup or restore point.
2. Inspect auth column types before deployment. The ordered `2026_10_20_000000_upgrade_legacy_auth_ids_to_uuids` migration maps old bigint users to generated UUIDs, backfills session/PAT references, normalizes safe auth metadata, and aborts on orphaned references, unsupported tokenable types, or duplicate normalized emails. Fresh UUID schemas no-op. This data conversion is intentionally forward-only because discarded bigint identifiers cannot be reconstructed.
3. Deploy the code revision whose migrations were reviewed and tested against both a fresh database and the previous schema state.
4. Use the direct endpoint with dedicated deployment credentials. Serialize deployments so only one migration job runs.
5. Inspect before applying:

   ```bash
   composer install --no-dev --optimize-autoloader
   php artisan config:clear
   php artisan config:show database.default
   php artisan config:show database.connections.pgsql
   php artisan migrate:status
   php artisan migrate --pretend
   ```

6. Apply only the reviewed forward migrations:

   ```bash
   php artisan migrate --force
   php artisan config:cache
   php artisan queue:restart
   php artisan migrate:status
   ```

7. Verify application health and worker/scheduler health before completing deployment.

Do not automatically roll back after a partial migration failure. Preserve logs, stop the release, assess which migrations committed, and use a reviewed forward fix or tested restore plan. Never run ordinary development seeders during a shared or production upgrade.

## SSL and pooler troubleshooting

- `could not translate host name` or direct-endpoint timeouts can indicate unavailable IPv6/DNS routing. Confirm the exact Dashboard connection values and test with `psql`.
- Certificate or `no pg_hba.conf entry ... no encryption` errors usually mean SSL was omitted. Hosted Supabase uses `DB_SSLMODE=require`; local Supabase normally uses `disable`.
- If the direct endpoint is unreachable because the runner lacks compatible connectivity, use the Supabase **session pooler** as an explicit fallback. Copy its host and username from the Dashboard, keep port `5432`, `DB_SSLMODE=require`, and `DB_SEARCH_PATH=public`.
- Record that fallback in deployment evidence. Do not silently replace the direct endpoint.
- Supabase's transaction pooler normally uses port `6543`. Transaction pooling is not for migrations because migrations and schema inspection can require session-level state. Do not run Laravel migrations through it.
- A pooler authentication error commonly means the pooler-specific username (often `postgres.<project-ref>`) was not used. Copy it exactly rather than assuming the direct username.
- If Laravel still reports old values, configuration is cached; clear it before troubleshooting the network.

Example session-pooler fallback:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=<session-pooler-host-from-dashboard>
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.<project-ref>
DB_PASSWORD=<database-password>
DB_SSLMODE=require
DB_SEARCH_PATH=public
```

## Configuration cache

Laravel reads environment values into configuration. After `php artisan config:cache`, changing `.env` does not update the running configuration until the cache is rebuilt:

```bash
php artisan config:clear
php artisan config:show database.default
php artisan config:show database.connections.pgsql
php artisan config:cache
```

Long-running queue workers must be restarted after database configuration changes. Never call `env()` from application code; read resolved settings through `config()`.

## PostgreSQL test database

The PHPUnit defaults target a local, disposable PostgreSQL database named `rentos_test` on port `5432`. Create that database or override the `DB_*` variables for an isolated container, then run the suite:

```bash
export DB_CONNECTION=pgsql
export DB_HOST=127.0.0.1
export DB_PORT=5432
export DB_DATABASE=rentos_test
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
export DB_SSLMODE=disable
export DB_SEARCH_PATH=public

composer test
```

The schema tests rebuild tables and are destructive to the configured test database. Never point the test process at a shared, staging, or production database.

## Verification checklist

Run non-destructive checks against the intended endpoint:

```bash
php artisan config:show database.default
php artisan config:show database.connections.pgsql
php artisan db:show --database=pgsql
php artisan migrate:status
```

From `psql`, verify the active identity and schema:

```sql
SELECT current_database(), current_user;
SELECT current_setting('search_path');
SELECT to_regnamespace('public');
```

Through Laravel, the configured connection sets `search_path` to `public`. A plain `psql` session on Supabase already uses `public`. Do not infer the Laravel connection from a different database.

## References

- [Laravel database documentation](https://laravel.com/docs/13.x/database)
- [Laravel migration documentation](https://laravel.com/docs/13.x/migrations)
- [Supabase: connect to PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Laravel quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/laravel)
