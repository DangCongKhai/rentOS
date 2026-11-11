# Non-functional requirements

Read [performance](performance.md), [security](security.md), [reliability](reliability.md), [usability](usability.md), [observability](observability.md) and [deployment](deployment.md). These are delivery obligations in every owning feature issue, not a last-phase testing handoff.

## Required test policy

Meaningful unit, frontend component and Laravel API/PostgreSQL integration tests; independent transactions for constraint/race checks; short manual screen checks. No mandatory automated browser/E2E framework or CI suite. Report separate UI/business and API coverage strictly above 70% as the course states; do not invent already-passing results or inflate coverage with exclusions.

TypeScript response types are explicitly maintained and checked now. RNT-01 documents future OpenAPI-to-TypeScript setup only; installing/running a generator and generated-file CI drift checks are not current acceptance requirements.

Latency budgets, hardware/load volumes, RPO/RTO and hosted performance claims remain unverified until measured/decided. Local queries can be profiled; hosted timing provides separate integration evidence.
