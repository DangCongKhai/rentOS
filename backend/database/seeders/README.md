# Development seeders

`BaselineSeeder` creates a deterministic development baseline:

- 10 users: 1 admin, 5 owners, 4 tenants
- one published property, unit, and listing for each place in Da Nang city
- coordinates, names, street addresses, wards, and city come from `da-nang-places.json`
- property and unit galleries that reuse one shared image library under `seed/`

It does not seed audit logs, idempotency records, or the notification outbox. It upserts its own UUID rows and does not delete unrelated data. It refuses to run in production.

```bash
php artisan migrate
php artisan db:seed --class='Database\Seeders\BaselineSeeder' --no-interaction
php artisan fixtures:media-upload
```

`db:seed` writes database rows. `fixtures:media-upload` uploads that same library once to the public Supabase bucket and skips objects that are already there. Listing URLs are built from `SUPABASE_URL` and the stored object path. Add `--overwrite` only when the library files themselves changed. The bucket must be public or the browser cannot load the photos.

Development-only accounts use the password `password`:

- Admin: Mai Anh Tran, `admin@rentos.test`
- Owners: Quoc Huy Le `owner1@rentos.test`, Thu Ha Nguyen `owner2@rentos.test`, Minh Khoa Pham `owner3@rentos.test`, Bao Ngoc Vo `owner4@rentos.test`, Duc Thinh Hoang `owner5@rentos.test`
- Tenants: Lan Chi Dang `tenant1@example.com`, Hoang Nam Bui `tenant2@example.com`, Thanh Tam Ly `tenant3@example.com`, Gia Han Truong `tenant4@example.com`

To create five pending RNT-05 rental requests for the first demo owner, run:

```bash
php artisan db:seed --class='Database\Seeders\Rnt05ProposalRequestsSeeder' --no-interaction
```

The seeder uses published listings from the baseline data and is safe to rerun; existing demo requests are skipped. If no baseline listing is available for `owner1@rentos.test`, run `BaselineSeeder` first. The five test tenants are `tenant.rnt05.1@rentos.test` through `tenant.rnt05.5@rentos.test`, all with the password `password`.

To create a confirmed tenancy with one pending RNT-09 renewal request for the baseline owner and tenant, run:

```bash
php artisan db:seed --class="Database\\Seeders\\Rnt09RenewalFlowSeeder" --no-interaction
```

The seeder is limited to local/testing PostgreSQL databases and is safe to rerun; it recognizes its fixture by a stable tenancy operation ID. It requires the baseline owner’s published listing and a ready unit. Sign in as `owner1@rentos.test` or `tenant1@example.com` with password `password` to test the workflow. The command prints the tenancy and renewal request IDs. The seeded confirmed lease starts in 14 days and runs for six months, leaving time to exercise the renewal proposal and response flow.

Image sources, the `seed/` prefix, and rerun behavior are documented in the [media fixture setup](../../docs/setup/media-fixtures.md).
