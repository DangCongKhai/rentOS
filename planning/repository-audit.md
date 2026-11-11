# Repository audit — source implementation unverified

## Evidence available

The current functional workbook, live task Sheet, previous domain/course specification and the user’s two folder-structure screenshots were inspected to prepare this package. The 16 planning issues were reconstructed from the current Sheet; deleted GitHub issues were not used. No GitHub publishing or repository source changes were performed.

## Evidence not available

No current repository checkout, branch/commit, file tree, lockfiles, route list, migration history, test output, CI run, deployed URL, issue list or collaborator handles were inspected. Therefore no code feature is marked implemented/missing solely from these docs. The screenshot of a planning folder shows a desired structure, not proof that any listed code or issue exists.

## Required local audit before coding/publication

- Inspect actual AGENTS.md and existing docs/planning before merging this package; preserve compatible implementation and merge the root README links.
- Verify git remotes/branch state, actual Next.js/Laravel versions, package managers, monorepo paths and env templates. This project uses Laravel; do not import the separate Prisma/full-Next.js design.
- Inspect migrations/private-schema bootstrap, provider-managed auth/storage references, favourite uniqueness, UUID tokenable links, overlap/immutable/write-once/deferred constraints and actual seeds.
- Inspect real Sanctum issuance/auth:sanctum/abilities/Policies, token lifecycle and privacy; Scramble output; Telescope configuration/access/filtering/pruning; workers/scheduler and monitoring/alert delivery.
- Inspect implemented frontend and actual Resources/contracts. Check TanStack Query versus server-cache boundaries and account switching. Type generation remains future documentation only.
- Run documented unit/component/API/PostgreSQL checks and capture actual coverage, query/image measurements and operational evidence. Do not install E2E automation solely for this plan.
- Record audit findings with real file paths/commits/test commands and map only remaining work into these existing coherent issues. Preserve actual statuses/URLs if already published; never fabricate or restore deleted issue IDs.

## Audit status

Planning/document consistency: validated in this package. Repository implementation audit: not performed. Live deployment and application acceptance: not verified.
