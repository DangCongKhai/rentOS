# Baseline database and media fixtures

The baseline is a development aid, not production data. Use this flow only when `APP_ENV` is `local`, `development`, `staging`, or `testing`, and only against an isolated database and private Storage bucket. `BaselineSeeder` blocks production; `fixtures:media-upload` refuses every environment outside the explicit allowlist.

## Prerequisites

1. Complete the [database bootstrap and migrations](database-connection.md).
2. Create a **public** Supabase Storage bucket named `property-media`. Listing pages are public, so the browser loads each photo directly. A private bucket would reject those URLs.
3. Obtain the project URL and service-role key from the server-side Supabase project settings. The key is used only to upload. It is never placed in an image URL.
4. Confirm the database and bucket are isolated development or staging resources.

The service-role key bypasses Storage access controls. Keep it in the backend environment only. Never commit it, log it, send it to a browser, or expose it through a `NEXT_PUBLIC_*` variable.

Configure `backend/.env`:

```dotenv
APP_ENV=local
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<backend-only-service-role-key>
SUPABASE_STORAGE_BUCKET=property-media
```

Then clear cached configuration:

```bash
php artisan config:clear
```

## Part A: seed the database

Run migrations first, then seed the stable baseline:

```bash
php artisan migrate
php artisan db:seed --class='Database\Seeders\BaselineSeeder' --no-interaction
```

The seeder reads `database/seeders/da-nang-places.json` and upserts one published property, unit, and listing per place, up to 300. The current file contains 200 places, all in Đà Nẵng. It also writes `property_media` rows that share paths under the reserved `seed/` prefix. Those rows store the object path, not a URL. The listing API turns each path into `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`. The seeder does not upload the files and it does not delete unrelated rows.

Rerunning updates those stable UUID rows. Media IDs in the seeder's own UUID prefixes that are no longer part of the library are removed. A media row someone added by hand, with a normal UUID, is left in place.

Development-only sign-in credentials are documented in the [seeder README](../../database/seeders/README.md).

## Part B: upload the shared library once

After the library files exist locally, upload each missing object:

```bash
php artisan fixtures:media-upload
```

The command reads `database/seeders/fixtures/media/manifest.json`, checks the public bucket, and uploads only objects that are not already there. A second run skips existing objects. Pass `--overwrite` to replace them. Replacing one object changes every listing that points at it. The command never prints the service-role key and never uploads a path outside `seed/`.

Part A and Part B can run in either order. Database rows store object paths, not public URLs.

## Reserved prefix and deletion

`storage_path` is not an ownership key. Many `property_media` rows may share one object. Deleting one row must not delete a file that another live row still uses.

Objects under `seed/` are the shared demo library. Ordinary media removal must not delete them. `App\Domain\Media\SharedStorageRetention` encodes that rule: a physical delete is allowed only for a non-seed path that has no remaining row with `purged_at` still null. The application does not yet expose a media-deletion endpoint; new deletion code has to call this check before removing a Storage object.

## Counts

The seeder prints property, unit, listing, media-row, and unique-path totals. Expect about 200 properties and roughly 100 library objects, with several media rows per object.
