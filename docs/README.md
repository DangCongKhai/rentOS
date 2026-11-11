# rentOS documentation

Read product → domain → module PRD → workflow → acceptance → architecture before implementing an issue. The current plan and owner are in [planning](../planning/issue-plan.md).

1. [Product overview](01-product/product-overview.md)
2. [Domain overview](02-domain/domain-overview.md)
3. [Module index](#modules)
4. [Separate workflows](04-workflows/README.md)
5. [Non-functional requirements](05-non-functional-requirements/README.md)
6. [Acceptance and traceability](06-acceptance/README.md)
7. [Architecture](07-architecture/README.md)
8. [Assumptions](08-project/assumptions.md), [constraints](08-project/constraints.md), [open questions](08-project/open-questions.md), [glossary](08-project/glossary.md)

## Modules

- [M01-identity-access — Identity, profiles and API permissions](03-modules/M01-identity-access/README.md)
- [M02-property-units-media — Property, unit, photo, policy and amenity management](03-modules/M02-property-units-media/README.md)
- [M03-listings-moderation — Owner listings and initial admin approval](03-modules/M03-listings-moderation/README.md)
- [M04-discovery-favourites — Landing page, location/date search and private favourites](03-modules/M04-discovery-favourites/README.md)
- [M05-rental-requests — Tenant rental requests and owner request lists](03-modules/M05-rental-requests/README.md)
- [M06-tenancies-contracts — Tenancy proposals, immutable agreements and lifecycle](03-modules/M06-tenancies-contracts/README.md)
- [M07-renewals — Renewal requests and new contract segments](03-modules/M07-renewals/README.md)
- [M08-reports-admin — Listing reports and admin hide/restore](03-modules/M08-reports-admin/README.md)
- [M09-notifications-audit — Private notifications, audit history and queued delivery](03-modules/M09-notifications-audit/README.md)
- [M10-operations-delivery — Shared setup, API docs, monitoring, tests and release](03-modules/M10-operations-delivery/README.md)

## Source and change policy

- [Current functional requirements workbook](https://docs.google.com/spreadsheets/d/1w33EYYbyNxTfkC-yxoUO5PwWIAbBhakI/edit?usp=drivesdk&ouid=106252598381185742228&rtpof=true&sd=true): 83 FRs, 343 acceptance specifications, 20 dictionary entities and 256 columns; accessed 23 October 2026.
- [Current task sheet](https://docs.google.com/spreadsheets/d/1KGFVfL88V_y3_pbkqb4at4xT3FxdkfP4DcFGV8bICm4/edit): 16 grouped issues; latest named assignments and setup boundaries.
- User screenshots: teacher’s Task 4 explicitly requires Sanctum token management and token scopes/permissions. Telescope and Scramble are also mandatory; no assumed waiver.
- Earlier project/course specifications supply unchanged business/NFR/submission constraints. The original provided documentation is superseded where it described JWT-only API access, anonymous photo review or older member aliases.

Record approved product changes in the owning PRD, workflow, acceptance cases and architecture together; update planning coverage in the same PR. Product requirements do not become completed because a document passes a structural check.
