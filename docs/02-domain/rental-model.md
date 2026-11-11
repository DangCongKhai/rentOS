# Rental model
Domain/profile PK/FK identifiers are UUIDs; Sanctum’s framework token primary key may be bigint; version_number is a sequential integer per tenancy, not an identity key. Store timestamps in UTC, display Asia/Ho_Chi_Minh; use PostgreSQL DATE for rental boundaries and NUMERIC(14,0) for VND amounts.

Confirmed contracts are consecutive segments: ORIGINAL Jan1–Jun30, RENEWAL Jul1–Dec31. A correction of an unconfirmed segment adds another row, keeps type/request, links supersedes_contract_id and requires new acknowledgements. No normal mutation/deletion of submitted terms/documents. Embedded acknowledgement metadata alone may transition null-to-value once under participant and current-version checks.

confirmed_start/end are transactional projections, not editable contract terms. blocked_start/end equals confirmed span plus the sole pending segment; original pending has only blocked dates. A renewal decline/expiry restores the original confirmed span. The database uses these projected ranges for inter-tenancy nonoverlap; deferred consistency checks must verify projections against contracts, because an ERD alone cannot.

Source fields, nullability and defaults are in [database dictionary](../07-architecture/data-dictionary.md); schema code is in [Mermaid schema](../07-architecture/database-schema.mmd).
