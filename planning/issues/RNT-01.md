<!-- rentos-backlog-v2: RNT-01 -->

# RNT-01: Set up database, seed data, Telescope, Scramble and CI

## Outcome

Khai sets up the shared Laravel/Supabase foundation so teammates can migrate, seed, and start feature work. Authentication (Fortify and Sanctum) belongs to RNT-03.

## Ownership and order

- Phase 1.
- Implementation: **Khai**.
- Reviewer: **Kien**.
- Prerequisites: None.
- GitHub: https://github.com/ndrhmdk/rentOS/issues/97

## Scope

- Document how to connect Laravel to a local or personal remote Supabase Postgres database.
- Create the current MVP tables and useful constraints. Later feature owners add additive migrations only when a feature needs a schema change.
- Seed key tables for local testing: about 10 users and at least 20 properties, with units and listings. Do not reseed production.
- Install Telescope for local debugging and document how to open it.
- Install Scramble and write `TYPESCRIPT_STRATEGY.md` for a later OpenAPI-to-TypeScript step. Do not run a type generator now.
- Write short `backend/AGENTS.md` and `frontend/AGENTS.md`. Tests should cover feature and business behavior, not setup configuration.
- Add a basic CI workflow that runs frontend lint/typecheck/build and backend tests.

## Out of scope

- Fortify, Sanctum, CSRF, CORS, and session-cookie setup. Those belong to RNT-03.
- Feature screens and feature business rules.
- Deploy pipelines.
- Generated TypeScript clients.

## Done when

- [ ] A teammate can copy the env example, migrate, and seed a personal Supabase or local Postgres database.
- [ ] Seed data includes about 10 users and at least 20 properties with units and listings.
- [ ] Telescope is installed and documented for local use.
- [ ] Scramble is installed and the TypeScript strategy is documented.
- [ ] Frontend and backend agent docs say to test feature behavior.
- [ ] CI runs the frontend checks and backend tests.

RNT-01 is a planning key, not a GitHub issue number.
