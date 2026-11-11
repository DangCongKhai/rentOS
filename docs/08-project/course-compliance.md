# Course requirements and evidence

The actual teacher brief governs scoring. Original project duration: five weeks; total 10 marks, final-project weighting 50%. This package does not invent a waiver or assert implemented evidence.

| Criterion | Marks | Printed requirement | Owning issue(s) | Named contributors | Evidence required |
| --- | --- | --- | --- | --- | --- |
| T1a | 0.25 | GitHub repository | RNT-01, RNT-16 | Khai, Tri | Repository URL/access; organized source/history |
| T1b | 0.25 | Good commit messages | RNT-01 | Khai | Atomic commits referring to actual issue; meaningful purpose |
| T1c | 0.25 | GitHub Issues | RNT-01 | Khai | Well-defined issue bodies with acceptance/dependency/owner links |
| T1d | 0.25 | GitHub workflow | RNT-01, RNT-13 | Khai | Topic branches, linked issues and PR review history; CI supports but does not replace these |
| T2a | 0.5 | Database design/migrations | RNT-01, RNT-13 | Khai | Reproducible Laravel migrations, UUID schema, constraints/ERD incl favourites |
| T2b | 0.5 | Seeders | RNT-01 | Khai | Deterministic representative public/hidden/suspended, properties and units, contracts, reports/favourites scenarios |
| T3a | 0.25 | Blade Livewire Tailwind | RNT-01 | Khai | Printed rubric names these; Next.js substitution user-reported approved, exact scoring evidence needed |
| T3b | 0.25 | Registration/login | RNT-03 | Hien | Email confirmation/login/profile bootstrap and negative tests under approved provider |
| T3c | 0.25 | CSRF and server validation | RNT-01, RNT-03, RNT-07, RNT-08 | Hien, Khai, Tri | Fortify/Sanctum session forms with real CSRF enforcement: valid submission and missing/mismatched-CSRF denial before writes; server validation and field feedback |
| T3e | 0.25 | Query/filter/display | RNT-06, RNT-07, RNT-15 | Hien, Khai, Tri | Seeded search full interval/same-unit filters, listing details and private favourites |
| T3f | 1 | External API integration | RNT-02, RNT-14 | Kien | Use Supabase Storage API integration: auth/config, completed upload/private download, error handling/logging, tests and demo; do not claim an SDK import alone |
| T3g | 1 | UI/business unit+integration tests | RNT-01, RNT-02, RNT-03, RNT-04, RNT-05, RNT-06, RNT-07, RNT-08, RNT-09, RNT-10, RNT-11, RNT-13, RNT-14, RNT-15, RNT-16 | Hien, Khai, Kien, Tri | Meaningful UI/business test suite and separately reported coverage strictly greater than70% |
| T4a | 0.5 | Resource Controllers CRUD | RNT-02, RNT-03, RNT-04, RNT-05, RNT-06, RNT-07, RNT-08, RNT-09 | Hien, Khai, Kien, Tri | Actual resource controllers/FormRequests/Resources with HTTP/status/validation/ownership semantics |
| T4b | 0.25 | Sanctum token security | RNT-01, RNT-03, RNT-13 | Hien, Khai | Settings > API tokens create/list/revoke; real cookie-free Sanctum token tests prove allowed read, denied write, expiry and revoked-token 401. UI is the user-requested implementation; rubric requires token management/scopes. |
| T4c | 0.25 | Scramble | RNT-01 | Khai | Installed compatible Scramble generates API docs from real code; bearer scheme and409/422 examples |
| T4d | 1 | API unit+integration tests | RNT-01, RNT-02, RNT-03, RNT-04, RNT-05, RNT-06, RNT-07, RNT-08, RNT-09, RNT-10, RNT-11, RNT-13, RNT-14, RNT-15, RNT-16 | Hien, Khai, Kien, Tri | Laravel API/action/policy integration coverage strictly greater than70%; real PostgreSQL race tests |
| T5a | 0.25 | Telescope | RNT-01 | Khai | Configured compatible Telescope, restricted diagnostics, useful request/query/job evidence |
| T5b | 0.25 | Error handling/logging | RNT-12 | Tri | Structured logs, friendly errors and actual critical error report/alert evidence |
| T5c | 0.25 | Slow-query alert | RNT-12 | Tri | Threshold rule and delivered deduplicated alert, not just query display |
| T5d | 0.25 | Server monitoring | RNT-12 | Tri | CPU/memory/disk/network collector and threshold alert evidence on chosen environment |
| T6a | 0.5 | Asynchronous processing | RNT-09, RNT-10 | Khai, Kien | Queue worker/outbox handling and scheduler jobs; failure/retry tests and duplicate safety |
| T6b | 0.5 | Resource loading | RNT-11, RNT-14 | Hien, Kien | Lazy loading/code split/images/bundles with measurable browser evidence |
| T6c | 0.5 | Caching | RNT-11, RNT-15 | Hien | Document selected public caching/revalidation/invalidation and private isolation tests |
| T6d | 0.5 | Antipattern mitigation | RNT-11, RNT-14 | Hien, Kien | Eager loading/indexes/query profiling and before/after evidence; no false optimization claims |

## Submission

- Real root application README with actual setup/tools/env/migrations/seeds/worker/scheduler/run/test instructions, overview, screenshots and ERD.
- Source repository, meaningful commits, topic branches and issue-linked reviewed PRs. Creating this pack does not establish any of them.
- Each member authors their own self-report for all five sprints. The brief states a 10% group-mark deduction for late/missing reports; collecting links does not replace personal authorship.
- Accessible public/unlisted demo link: MP4 at least 720p, no longer than 10 minutes; show real behavior/tests/docs/alerts where appropriate, not invented results.
- Demonstrate >70% UI/business coverage and separately >70% Laravel API coverage with meaningful tests; no mandatory E2E/browser automation is added by this plan.

Supabase Storage API evidence requires actual completed upload/private download and failure handling/tests, not merely an SDK dependency. Telescope is diagnostics; slow-query/critical/resource alert delivery needs actual controlled evidence. JSONB is bounded descriptive data on a relational core.
