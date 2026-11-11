# Terminology

| Term | Meaning |
| --- | --- |
| Property | Owner-managed physical rental location (properties) |
| Unit | Independently rentable space in a property (units) |
| Listing | Public rental advertisement selecting existing units (listings) |
| Rental request | Tenant application/contact record; remains PENDING during discussion |
| Owner rental-request list | Private list of applicants/contact details/status/actions; not in-app messaging |
| Tenancy | Tenant–unit relationship with lifecycle state and blocking/confirmed date projections |
| Contract version | Immutable submitted tenancy_contracts row with document hash/terms and write-once participant decisions |
| Temporary reservation | Dates blocked by a pending-confirmation tenancy or renewal proposal |
| Operational status | READY, MAINTENANCE or RETIRED; separate from date-based vacancy |
| Initial listing approval | Admin approval before first publication; later valid edits need no reapproval |
| Admin suspension | Independent restriction that owners cannot clear by edits or publication |
| Favourite property | Private persistent user/property relation; saves do not reserve units |
| Unreferenced photo-file deletion | Scheduled removal of abandoned/removed stored photos after retention and final reference checks |
| Token ability | Server-approved Sanctum permission; always combined with resource Policies |
| Browser session | Laravel session identified by an HttpOnly cookie; browser mutations also require a matching CSRF token |
| Personal API token | Independently created Sanctum credential for allowed non-browser APIs; scoped, expiring and revocable |
| CSRF token | Session-bound value sent with browser mutations; it does not authenticate the user by itself |
| API token | Hashed, expiring Sanctum credential used on private Laravel product endpoints |
