# State transitions

| Entity | From | To | Guard/effect |
| --- | --- | --- | --- |
| rental_requests | PENDING | ACCEPTED | Only proposal transaction succeeds; never manual Accept |
| rental_requests | PENDING | REJECTED | Owner reason or due15day no-availability decision |
| rental_requests | PENDING | WITHDRAWN | Tenant withdraws; no reservation to release |
| tenancies | new | PENDING_CONFIRMATION | Original contract+owner confirmation+hold+request acceptance |
| tenancies | PENDING_CONFIRMATION | CONFIRMED | Exact same-row tenant confirmation before deadline |
| tenancies | PENDING_CONFIRMATION | AWAITING_REVISION | Tenant decline; clear pending hold |
| tenancies | AWAITING_REVISION | PENDING_CONFIRMATION | New corrected contract and reacquired dates |
| tenancies | PENDING_CONFIRMATION | EXPIRED | Due deadline reaped explicitly |
| tenancies | CONFIRMED | ACTIVE | Owner move-in action on/after start |
| tenancies | CONFIRMED | CANCELLED | Authorized pre-start cancellation/reason |
| tenancies | ACTIVE | ENDED | Actual ending/reason; terminate pending renewal work |
| tenancy_renewal_requests | PENDING | ACCEPTED | Mutual confirmation of current renewal contract; span promotion |
| tenancy_renewal_requests | PENDING | REJECTED/CANCELLED | Owner rejection/tenant withdrawal; release unconfirmed extension |
| listings moderation | DRAFT/REJECTED | PENDING | First complete submission and captured revisions |
| listings moderation | PENDING | APPROVED/REJECTED | Admin exact submitted package decision |
| listings publication | DRAFT/HIDDEN | PUBLISHED | Initial approval, completeness and no suspension; availability check |
| listings publication | PUBLISHED | HIDDEN | Owner hide; do not infer from one accepted rental request |
| listing_reports | OPEN | REVIEWING | Admin investigation |
| listing_reports | OPEN/REVIEWING | RESOLVED/DISMISSED | Reasoned authorized outcome |

Admin suspension is a separate timestamp/by/reason restriction, not a new initial review. Contract decisions are fields, not a separate table or a mutable terms status. Favourites use row presence, no status enum. Duplicate terminal replays are idempotent or409, never resurrection.
