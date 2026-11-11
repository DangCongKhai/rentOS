# Four-phase issue plan

Exactly 16 grouped issues, four per named member. All feature owners implement frontend/backend and their tests. Khai owns all initial shared setup in RNT-01; reviewers do not take over implementation. Issue count does not prove equal effort: reassess capacity at the actual schema/auth checkpoint without inventing deadlines.

## Phase 1: Shared setup, accounts, properties and admin approval

| Member | Issue | Complete outcome | Integration prerequisites |
| --- | --- | --- | --- |
| Khai | [RNT-01](issues/RNT-01.md) | Set up database, seed data, Telescope, Scramble and CI | None |
| Kien | [RNT-02](issues/RNT-02.md) | Manage properties, units, photos, amenities and owner listings | RNT-01, RNT-03, RNT-04 |
| Hien | [RNT-03](issues/RNT-03.md) | Implement account forms, session login, CSRF protection and API-token settings | RNT-01 |
| Tri | [RNT-04](issues/RNT-04.md) | Admin reviews and approves listings before first publication | RNT-01, RNT-03 |

## Phase 2: Listing browsing, rental requests, contracts and reports

| Member | Issue | Complete outcome | Integration prerequisites |
| --- | --- | --- | --- |
| Kien | [RNT-05](issues/RNT-05.md) | Create tenancy proposals and confirm the same contract version | RNT-01, RNT-06, RNT-07 |
| Khai | [RNT-06](issues/RNT-06.md) | Build the landing page, browse/search listings and view listing details | RNT-02, RNT-03, RNT-04 |
| Tri | [RNT-07](issues/RNT-07.md) | Submit/manage rental requests and save favourite properties | RNT-01, RNT-03, RNT-06 |
| Hien | [RNT-08](issues/RNT-08.md) | Report listings and let admins investigate, hide or restore them | RNT-01, RNT-04, RNT-06 |

## Phase 3: Renewals, automatic rules, background jobs and monitoring

| Member | Issue | Complete outcome | Integration prerequisites |
| --- | --- | --- | --- |
| Kien | [RNT-09](issues/RNT-09.md) | Request tenancy renewals, add contract versions and release expired reservations | RNT-05, RNT-10 |
| Khai | [RNT-10](issues/RNT-10.md) | Run background jobs, delete unreferenced photo files after retention and deliver notifications | RNT-02, RNT-05, RNT-08 |
| Hien | [RNT-11](issues/RNT-11.md) | Apply the 15-day request rule, cache public search results and refresh them after listing changes | RNT-06, RNT-07, RNT-09 |
| Tri | [RNT-12](issues/RNT-12.md) | Monitor errors and slow queries, send alerts and show useful error screens | RNT-01, RNT-03, RNT-08 |

## Phase 4: Final testing, fixes and submission

| Member | Issue | Complete outcome | Integration prerequisites |
| --- | --- | --- | --- |
| Khai | [RNT-13](issues/RNT-13.md) | Verify contract permissions, conflicting updates and deployment failure recovery | RNT-09, RNT-10, RNT-12 |
| Kien | [RNT-14](issues/RNT-14.md) | Verify owner property/listing/photo actions, remove repeated database queries and reduce image downloads | RNT-02, RNT-06, RNT-10 |
| Hien | [RNT-15](issues/RNT-15.md) | Check tenant account/search/request/favourite behavior, API responses and test coverage | RNT-07, RNT-09, RNT-11 |
| Tri | [RNT-16](issues/RNT-16.md) | Verify admin approval/report permissions and prepare reproducible setup/demo evidence | RNT-04, RNT-08, RNT-12, RNT-13, RNT-14, RNT-15 |

## Early checkpoints and independent work

1. Khai publishes complete schema/seeds, API/error/revision conventions and initial Fortify/Sanctum/CSRF/Scramble/Telescope configuration early within RNT-01.
2. Hien publishes the session/CSRF, profile and separate personal-token/ability contracts early within RNT-03. Kien/Tri can start with local fixtures and agreed request/response contracts while account UI is completed.
3. Kien’s RNT-02 keeps Create property and Create listing separate. Tri’s RNT-04 can use seeded complete packages before the owner UI exists. Khai’s RNT-06 consumes the real public API for landing/location/date search/details.
4. Tri owns RNT-07 rental requests/favourites. Hien owns RNT-08 reports/admin hide/restore. Kien owns RNT-09 renewals; Khai owns RNT-10 jobs, notifications and unreferenced-photo-file deletion. Telescope initial setup is Khai/RNT-01; diagnostics/actual alerts remain Tri/RNT-12.
5. Every member runs committed migrations/tests locally and writes their own feature tests. Later persisted-field changes get new reviewed migrations; UI labels do not imply column renames. CI uses disposable PostgreSQL/Supabase; only reviewed main deploy migrates the shared environment.

## Completion gates

Phase 1: reproducible setup/CI, real auth/profile, seeded admin approval and separate owner properties and units/listing actions. Phase 2: public browsing, pending request/contact discussion, favourites, atomic tenancy/contract agreement and listing reporting through actual APIs. Phase 3: renewal/expiry/15-day decisions, worker/private notifications, documented cache privacy/invalidation and actual alerts. Phase 4: focused API/component/constraint regressions, measured query/image evidence and reproducible setup/demo/sprint reports.

One valid topological order (independent work can overlap):

RNT-01 → RNT-03 → RNT-04 → RNT-02 → RNT-06 → RNT-07 → RNT-08 → RNT-05 → RNT-12 → RNT-10 → RNT-09 → RNT-14 → RNT-11 → RNT-13 → RNT-15 → RNT-16

## Prompt for a local AI to publish these issues

```text
Read the repository’s actual AGENTS.md, docs/README.md, planning/issue-plan.md,
planning/coverage-validation.md, planning/repository-audit.md and
planning/issues-manifest.json. Read every planning/issues/RNT-xx.md body.
Verify repository remote/authentication and current implemented code first.
Use these 16 coherent issue drafts; do not restore/reuse deleted issues or
create migration/shell/frontend/backend/test micro-issues. Resolve Khai, Kien,
Hien and Tri to actual collaborator handles; leave assignees empty if unknown.

This prompt, when explicitly invoked for publishing, authorizes creating the
16 missing issues in the verified target repository. Check each stable marker
<!-- rentos-backlog-v2: RNT-xx --> before create/retry. Use structured arguments
or gh issue create --body-file; preserve actual newlines. Create in manifest
topological order, record returned real issue numbers/URLs, then link actual
dependencies without changing planning keys. Preserve the four phases and
current owners. Identify already implemented work with evidence and adjust
remaining checklists honestly; never fabricate unfinished/completed code.

Fortify accounts, Sanctum sessions/CSRF, separate PAT management/scopes, Scramble and Telescope setup are mandatory. Supabase provides database/storage only; do not reinstate the old identity-token bridge.
Khai owns initial shared setup. RNT-07 belongs to Tri; RNT-08 to Hien;
RNT-09 to Kien; RNT-10 to Khai. Require unit/component/API/PostgreSQL tests,
not automated browser/E2E tasks or a browser-test CI gate. TypeScript generator
setup is documentation only. Keep property/listing workflows separate.

Do not implement or push app code, change schemas, delete unrelated issues or
invent URLs. If authentication/target access is unavailable, retain drafts and
report the exact missing access. Summarize created/existing/draft counts using
actual results; do not claim these issues already exist because this pack does.
```
