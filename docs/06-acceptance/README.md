# Acceptance and evidence

83 FRs (81 existing IDs plus FR89/FR90); 343 unique acceptance specifications from the current workbook. [Traceability](traceability-matrix.md) maps each FR to its module, owning issue and verification issue. [Test scenarios](test-scenarios.md) preserves all IDs, types, triggers and expected outcomes.

Cases describe intended behavior, not executed tests. P2 rows remain deferred; FR76 is a scope rule. Unit/component/API/PostgreSQL tests and manual UI checks implement the active cases. No mandatory E2E automation. Each member writes tests for their own feature; Hien coordinates coverage reports, not everyone’s implementation.
