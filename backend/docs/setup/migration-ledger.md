# Migration ledger

This ledger covers every table in the canonical [data dictionary](../../../docs/07-architecture/data-dictionary.md) and records the Workstream 2A implementation status.

- **Implemented baseline**: created by the unpublished initial migrations in RNT-01 Workstream 2A.
- **Deferred**: intentionally excluded from the MVP baseline; do not create its migration until the linked deferred requirements are activated.

The baseline includes PostgreSQL checks, partial and expression indexes, same-parent composite foreign keys, the tenancy exclusion constraint, profile synchronization, immutable contract safeguards, and deferred commit-invariant triggers. An ordered forward upgrade migration converts the old Laravel bigint users/session/PAT skeleton to UUIDs before profile/domain foreign keys; fresh UUID installations no-op. It does not include seed or media fixture work.

| Table                      | Scope                | Reason                                                                                                                                                                                           |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`                    | Implemented baseline | Laravel account: login, name, phone, admin flag, and account status. Domain foreign keys point here.                                                                                             |
| `properties`               | Implemented baseline | Core managed rental property record.                                                                                                                                                             |
| `units`                    | Implemented baseline | Rentable spaces belonging to properties.                                                                                                                                                         |
| `property_media`           | Implemented baseline | Stored property/unit media metadata and lifecycle state.                                                                                                                                         |
| `listings`                 | Implemented baseline | Public listing and initial moderation/publication state.                                                                                                                                         |
| `rental_requests`          | Implemented baseline | Tenant enquiries and owner outcomes.                                                                                                                                                             |
| `tenancies`                | Implemented baseline | Allocated tenancy lifecycle and contract projections.                                                                                                                                            |
| `tenancy_renewal_requests` | Implemented baseline | Renewal proposal workflow.                                                                                                                                                                       |
| `tenancy_contracts`        | Implemented baseline | Immutable original and renewal contract versions.                                                                                                                                                |
| `listing_reports`          | Implemented baseline | User reports and administrative investigation state.                                                                                                                                             |
| `audit_logs`               | Implemented baseline | Immutable business-action audit records.                                                                                                                                                         |
| `notifications`            | Implemented baseline | User-visible notification inbox keyed by audience and event_key. Delivery jobs are queued through Laravel's `jobs` table.                                                                       |
| `property_reviews`         | **Deferred**         | Property reviews and their moderation/display flows are P2-deferred under FR36, FR37, and FR79. Creating the table now would imply unsupported MVP submission, display, and moderation behavior. |
| `idempotency_records`      | Implemented baseline | Safe replay records for idempotent writes.                                                                                                                                                       |
| `personal_access_tokens`   | Implemented baseline | UUID-compatible Sanctum personal API tokens.                                                                                                                                                     |
| `favourite_properties`     | Implemented baseline | Current-user saved-property relation.                                                                                                                                                            |
| `sessions`                 | Implemented baseline | Database-backed Laravel browser sessions.                                                                                                                                                        |
| `password_reset_tokens`    | Implemented baseline | Laravel password broker tokens.                                                                                                                                                                  |

Framework support tables `cache`, `cache_locks`, `jobs`, `job_batches`, and `failed_jobs` are also implemented in the `public` schema.

## Workstream 2A verification

The PostgreSQL integration suite rebuilds the baseline in an isolated database and verifies table presence/absence, UUID compatibility, upgraded-versus-fresh auth column catalog parity (including reset-token email and timestamp semantics), listing submission/approval/publication snapshots, triggers, uniqueness/check constraints, committed rollback invariants, true concurrent GiST overlap rejection, same-parent references, and immutable/write-once contract rules. The baseline seeder adds the local demo users, properties, units, and listings separately. Telescope tables are local debugging storage and are not domain tables.

`btree_gist` is installed with `CREATE EXTENSION IF NOT EXISTS` for the tenancy exclusion constraint. The extension intentionally persists after migration rollback because extensions are database-level shared infrastructure and dropping one can break unrelated objects; table constraints, functions, and triggers remain reversible.
