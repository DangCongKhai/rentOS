# Security design

| Boundary | Required control | Negative evidence |
| --- | --- | --- |
| Account lifecycle | Fortify validation, password hashing, email verification, rate limits, session rotation | Invalid credentials, duplicate registration race, forged verification/reset link |
| Browser forms | Stateful session and Laravel CSRF validation, exact credentialed CORS | Missing/wrong/other-session CSRF rejected before mutation; hostile origin |
| Non-browser API | Real hashed Sanctum PAT, finite expiry, explicit endpoint scope matrix | Read-only write denial; expired/revoked token; admin/session-only route denial |
| Token management | Verified active browser session; password confirmation + CSRF on mutation; owner-scoped queries | PAT-only management, foreign token ID, wildcard/admin ability, secret re-display |
| Resource access | Current active account, is_admin and ownership/participation Policies | Foreign-resource guesses and stale privilege assumptions |
| Recovery/suspension | Explicit all-session/PAT invalidation and remember-token rotation | Old cookie and token replay after committed reset/suspension |
| Storage and diagnostics | Private buckets, unexposed auth tables, restricted Telescope and secret redaction | Raw credential/contract/contact exposure and anonymous dashboard access |

Session authentication and API tokens are separate credential modes. Browser logout invalidates that session; explicit token revocation affects the selected PAT. Password reset/change and suspension revoke all. Newly authenticated requests must respect committed revocation; cancellation of already-authorized in-flight work is not promised.

Sanctum tokenCan returns true for first-party sessions; Policies must still enforce ownership/admin rules. Session-only middleware rejects a PAT-only caller even if that token belongs to an admin. Reject unsupported credential modes before sensitive work. Do not fall back to a bearer token to bypass a failed browser CSRF check.

Framework tests skip CSRF by default. Use a dedicated test harness that disables this bypass or an HTTP integration process with real CSRF enabled; prove 419 and zero writes. A test that only uses actingAs or withMiddleware is insufficient evidence by itself.

See [setup and API-token matrix](authentication-setup.md) and [acceptance cases](../06-acceptance/test-scenarios.md#fr90). Defaults and API-token scope choices are project decisions, not additional teacher requirements.
