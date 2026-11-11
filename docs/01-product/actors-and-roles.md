# Actors and roles

| Actor | Allowed behavior | Access boundary |
| --- | --- | --- |
| Guest | Browse eligible public listings and location/date results | No private contacts, saves, requests, contracts or admin diagnostics |
| Authenticated user as tenant | Private favourites, submit/withdraw own requests, participant contracts/renewals | Sanctum token ability plus current ownership/participant Policy |
| Authenticated user as owner | Own properties/units/photos/listings, applicant contact list and tenancy proposals | Ownership derived from authenticated profile; no client owner_id grant |
| Admin | Initial listing approval, reports, suspension/restore and restricted diagnostics | Current trusted is_admin plus appropriate token permission; user cannot self-grant |
| Worker/scheduler | Committed notifications, due expiry/15-day actions, unused-file deletion | Same domain actions/locks/idempotency as request paths; no private-data logging |

A user is not forced to choose a tenant-versus-owner identity. These capabilities follow resource relationships. Team members are implementation owners, not product roles: see [issue plan](../../planning/issue-plan.md).
