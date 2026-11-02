# Development seeders

`BaselineSeeder` creates a deterministic development baseline:

- 10 users: 1 admin, 5 owners, 4 tenants
- one published property, unit, and listing for each place in Da Nang city
- coordinates, names, and addresses come from that file; a missing district is estimated inside Đà Nẵng
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

Image sources, the `seed/` prefix, and rerun behavior are documented in the [media fixture setup](../../docs/setup/media-fixtures.md).
