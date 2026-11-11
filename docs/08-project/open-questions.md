# Open implementation decisions

These questions do not reopen agreed features or block unrelated work:

- Exact installed Laravel/Next.js/package versions, repository paths and existing implementation state.
- Final hosting provider, direct-DB connectivity/network support and deployment environments/approval configuration.
- Cache keys/TTL, unused-file retention, alert thresholds/channel, performance dataset/budget and backup RPO/RTO.
- Final controlled frontend/API domain names or tested same-origin proxy; confirm the proposed session lifetime, password-confirmation window and PAT expiry choices before implementation.
- Whether any non-local Telescope dashboard will be enabled; otherwise keep it disabled and demonstrate local diagnostics. Use the Laravel session and restricted admin gate if enabled.
- Record documentary scope of teacher approval for the Next.js substitution for printed Blade/Livewire wording ; CSRF now uses Fortify/Sanctum sessions and is required, with explicit positive/negative evidence. Sanctum, Scramble and Telescope are required and are not open waiver questions.
- Actual GitHub handles for Khai, Kien, Hien and Tri; existing source/features/tests and real submission/demo/report URLs.

Do not invent completed decisions, free hosting, test passes, alerts or a repository audit. Inspect first, then record the chosen bounded implementation in its ADR/PR.
