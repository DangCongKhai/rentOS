# rentOS backend

Laravel 13 API and application backend for rentOS, a rental-property management and discovery platform. Laravel is the application authority; Supabase provides PostgreSQL and object storage only.

Application and framework tables live in PostgreSQL's `public` schema, which is the schema Supabase already gives the app. Do not use Supabase Auth.

## Requirements

- PHP 8.4 or newer with `pdo_pgsql`
- Composer
- PostgreSQL client tools
- Node.js and npm for Vite assets
- Supabase CLI when using the recommended local Supabase stack

## Quickstart

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

Next, follow the [database connection guide](docs/setup/database-connection.md) to choose an isolated PostgreSQL endpoint, then migrate:

```bash
php artisan migrate
npm run build
composer run dev
```

The implemented schema baseline and intentionally deferred `property_reviews` table are recorded in the [migration ledger](docs/setup/migration-ledger.md).
For optional development data and real private Storage fixtures, follow the [two-part media fixture setup](docs/setup/media-fixtures.md).

## Telescope

Telescope is for local debugging. Copy `TELESCOPE_ENABLED=true` into your local `.env`, migrate, then open `http://localhost:8000/telescope` while `php artisan serve` is running. It stores entries on the same PostgreSQL connection as the app, in the `public` schema. Tests and CI keep Telescope disabled.

## API docs

Scramble serves the current API description at `http://localhost:8000/docs/api`. The future OpenAPI-to-TypeScript step is documented in [TYPESCRIPT_STRATEGY.md](../TYPESCRIPT_STRATEGY.md). Do not generate TypeScript types yet.

Never run `migrate:fresh`, reset/refresh commands, or development seeders against a shared or production database.

## Validation

```bash
php artisan config:show database.default
php artisan config:show database.connections.pgsql
composer test
vendor/bin/pint --dirty --format agent
```

## Project documentation

- [Database connection, migrations, upgrades, and troubleshooting](docs/setup/database-connection.md)
- [Development database and media fixtures](docs/setup/media-fixtures.md)
- [Seeder credentials and behavior](database/seeders/README.md)
- [Migration scope ledger](docs/setup/migration-ledger.md)
- [Architecture overview](../docs/07-architecture/architecture-overview.md)
- [Data dictionary](../docs/07-architecture/data-dictionary.md)
- [Authentication setup](../docs/07-architecture/authentication-setup.md)
- [RNT-01 delivery scope](../planning/issues/RNT-01.md)
