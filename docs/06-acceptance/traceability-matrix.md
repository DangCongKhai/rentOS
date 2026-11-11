# Requirement traceability matrix

Every active FR has a primary issue; feature owners write their tests. Deferred P2 behavior remains excluded from MVP implementation.

| FR | Requirement | Priority | Module | Primary issue | Additional checks | Cases |
| --- | --- | --- | --- | --- | --- | --- |
| FR01 | Email registration | P0 Must | M01-identity-access | RNT-03 |  | 4 |
| FR02 | Sign in with a Sanctum browser session | P0 Must | M01-identity-access | RNT-03 |  | 4 |
| FR03 | Google sign in | P2 Defer | M01-identity-access | Deferred |  | 3 |
| FR04 | Sign out of the browser session | P0 Must | M01-identity-access | RNT-03 |  | 3 |
| FR05 | Enforce account and resource permissions | P0 Must | M01-identity-access | RNT-03 | RNT-13 | 4 |
| FR06 | Profile and dual dashboards | P0 Must | M01-identity-access | RNT-03 |  | 3 |
| FR07 | Create property draft without moderation | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR08 | Manage and archive own property | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR09 | Upload property and unit photos | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR10 | Create property-level listing draft | P0 Must | M03-listings-moderation | RNT-02 | RNT-14 | 4 |
| FR11 | Edit listing without reapproval after initial approval | P0 Must | M03-listings-moderation | RNT-02 | RNT-14 | 4 |
| FR12 | Submit initial listing package | P0 Must | M03-listings-moderation | RNT-02 | RNT-14 | 4 |
| FR13 | Review initial listing packages | P0 Must | M03-listings-moderation | RNT-04 | RNT-16 | 3 |
| FR14 | Approve initial listing package | P0 Must | M03-listings-moderation | RNT-04 | RNT-16 | 4 |
| FR15 | Reject initial listing with reason | P0 Must | M03-listings-moderation | RNT-04 | RNT-16 | 3 |
| FR16 | Dedicated changes requested state | P2 Defer | M03-listings-moderation | Deferred |  | 1 |
| FR17 | Publish initially approved listing | P0 Must | M03-listings-moderation | RNT-02 | RNT-14 | 4 |
| FR18 | Hide or archive listing | P0 Must | M03-listings-moderation | RNT-02 | RNT-14 | 3 |
| FR19 | Search listings by location and date-based availability | P0 Must | M04-discovery-favourites | RNT-06 | RNT-15 | 6 |
| FR20 | Filter eligible units for the full requested interval | P0 Must | M04-discovery-favourites | RNT-06 | RNT-15 | 4 |
| FR21 | Display listing details and eligible unit cards | P0 Must | M04-discovery-favourites | RNT-06 | RNT-15 | 4 |
| FR22 | Interactive listing map | P2 Defer | M04-discovery-favourites | Deferred |  | 2 |
| FR23 | Synchronize map and filters | P2 Defer | M04-discovery-favourites | Deferred |  | 2 |
| FR24 | Geocode address | P2 Defer | M04-discovery-favourites | Deferred |  | 3 |
| FR25 | Submit rental request with contact details | P0 Must | M05-rental-requests | RNT-07 | RNT-15 | 5 |
| FR26 | Prevent duplicate pending rental requests | P0 Must | M05-rental-requests | RNT-07 | RNT-15 | 3 |
| FR27 | Tenant rental request dashboard | P0 Must | M05-rental-requests | RNT-07 | RNT-15 | 4 |
| FR28 | Withdraw pending rental request | P0 Must | M05-rental-requests | RNT-07 | RNT-15 | 3 |
| FR29 | Owner rental request inbox | P0 Must | M05-rental-requests | RNT-07 | RNT-15 | 4 |
| FR30 | Accept request when tenancy proposal commits | P0 Must | M05-rental-requests | RNT-05 |  | 4 |
| FR31 | Reject pending rental request | P0 Must | M05-rental-requests | RNT-07 | RNT-15 | 3 |
| FR32 | Audit request and tenancy outcomes | P0 Must | M05-rental-requests | RNT-07 | RNT-15 | 4 |
| FR33 | Enforce nonoverlapping unit rental periods | P0 Must | M06-tenancies-contracts | RNT-05 | RNT-13 | 5 |
| FR34 | Create tenancy proposal with temporary reservation | P0 Must | M06-tenancies-contracts | RNT-05 |  | 5 |
| FR35 | View tenancy timeline and contract versions | P0 Must | M06-tenancies-contracts | RNT-05 |  | 4 |
| FR36 | Submit tenancy based review | P2 Defer | M08-reports-admin | Deferred |  | 3 |
| FR37 | Display approved property reviews | P2 Defer | M08-reports-admin | Deferred |  | 2 |
| FR38 | Report public listing | P0 Must | M08-reports-admin | RNT-08 | RNT-16 | 5 |
| FR39 | Investigate reports and suspend listings | P0 Must | M08-reports-admin | RNT-08 | RNT-16 | 4 |
| FR40 | Public listing REST resources | P0 Must | M04-discovery-favourites | RNT-06 | RNT-15 | 3 |
| FR41 | Property and unit REST CRUD | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 3 |
| FR42 | Rental request tenancy and renewal action APIs | P0 Must | M06-tenancies-contracts | RNT-05 |  | 4 |
| FR43 | Protect APIs with Sanctum sessions and scoped tokens | P0 Must | M01-identity-access | RNT-03 | RNT-13 | 8 |
| FR44 | OpenAPI documentation | P1 Should | M10-operations-delivery | RNT-01 |  | 3 |
| FR45 | Asynchronous domain notifications | P1 Should | M09-notifications-audit | RNT-10 |  | 4 |
| FR46 | Cache public listing content with fresh visibility checks | P1 Should | M04-discovery-favourites | RNT-11 | RNT-15 | 3 |
| FR47 | Structured logs and critical alerts | P1 Should | M10-operations-delivery | RNT-12 | RNT-16 | 3 |
| FR48 | Development monitoring and slow query alerts | P1 Should | M10-operations-delivery | RNT-12 | RNT-16 | 3 |
| FR49 | Password reset and email confirmation | P0 Must | M01-identity-access | RNT-03 |  | 3 |
| FR50 | Create and bulk create units | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR51 | Edit unit details and advertised terms | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR52 | Manage operational status independently of availability | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR55 | Audit property unit and policy updates | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR56 | Select reorder and remove gallery images | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR57 | Update photos without a replacement-review workflow | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR59 | Delete unreferenced photo files after retention | P1 Should | M02-property-units-media | RNT-10 | RNT-14 | 4 |
| FR60 | Manage controlled property JSONB policies | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR61 | Resolve unit policy overrides and additional rules | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 4 |
| FR66 | Cancel proposals and end confirmed tenancies | P0 Must | M06-tenancies-contracts | RNT-05 |  | 5 |
| FR67 | Record original immutable agreement version | P0 Must | M06-tenancies-contracts | RNT-05 |  | 4 |
| FR68 | Submit one pending renewal request | P0 Must | M07-renewals | RNT-09 |  | 4 |
| FR69 | Withdraw or reject pending renewal request | P0 Must | M07-renewals | RNT-09 |  | 4 |
| FR70 | Propose renewal as new immutable version | P0 Must | M07-renewals | RNT-09 |  | 6 |
| FR71 | Keep immutable versions and effective agreement history | P0 Must | M06-tenancies-contracts | RNT-05 |  | 4 |
| FR72 | Reporter outcome and rate limits | P0 Must | M08-reports-admin | RNT-08 | RNT-16 | 4 |
| FR73 | Private notification inbox | P1 Should | M09-notifications-audit | RNT-10 |  | 3 |
| FR74 | Idempotent writes and stale revisions | P0 Must | M06-tenancies-contracts | RNT-01 | RNT-13 | 4 |
| FR75 | Transactional locking audit and consistency | P0 Must | M06-tenancies-contracts | RNT-01 | RNT-13 | 4 |
| FR76 | Deferred and excluded MVP scope | P3 Exclude | M10-operations-delivery | RNT-01 |  | 3 |
| FR77 | Calculate availability counts and rent ranges | P0 Must | M04-discovery-favourites | RNT-06 | RNT-15 | 4 |
| FR78 | Suspend and restore listings after reports or inspection | P0 Must | M08-reports-admin | RNT-08 | RNT-16 | 5 |
| FR79 | Moderate optional property reviews | P2 Defer | M08-reports-admin | Deferred |  | 3 |
| FR80 | Confirm move-in after mutual contract confirmation | P0 Must | M06-tenancies-contracts | RNT-05 |  | 4 |
| FR81 | Confirm the exact contract version mutually | P0 Must | M06-tenancies-contracts | RNT-05 | RNT-13 | 6 |
| FR82 | Decline and correct unconfirmed versions | P0 Must | M06-tenancies-contracts | RNT-05 |  | 5 |
| FR83 | Expire temporary confirmation reservations | P0 Must | M06-tenancies-contracts | RNT-09 |  | 5 |
| FR84 | Reserve renewal extension without releasing current occupancy | P0 Must | M07-renewals | RNT-09 | RNT-13 | 4 |
| FR85 | Apply 15-day rejection using actual availability | P0 Must | M05-rental-requests | RNT-11 | RNT-15 | 8 |
| FR86 | Enforce immutable contract terms and write-once confirmations | P0 Must | M06-tenancies-contracts | RNT-05 | RNT-13 | 5 |
| FR87 | Manage consistent standard and custom amenities | P0 Must | M02-property-units-media | RNT-02 | RNT-14 | 10 |
| FR88 | Save and manage favourite properties | P0 Must | M04-discovery-favourites | RNT-07 | RNT-15 | 10 |
| FR89 | Manage personal API tokens | P0 Must | M01-identity-access | RNT-03 | RNT-13 | 8 |
| FR90 | Protect browser forms against CSRF | P0 Must | M01-identity-access | RNT-03 | RNT-13 | 6 |
