# ADR-001: Fortify accounts, browser sessions and separate personal API tokens

Status: accepted project direction, 23 October 2026. Supersedes the earlier Supabase identity-to-Sanctum token bridge.

The teacher requires CSRF-protected forms and Sanctum token management/permissions. The user requests switching to Fortify/Sanctum and adding a token settings screen. Fortify supplies account routes; Sanctum supports browser sessions and independent personal tokens. Next.js remains the frontend; Supabase remains PostgreSQL/Storage.

Browser login creates a session, never a PAT. Laravel CSRF middleware checks browser mutations. Settings > API tokens creates named, scoped, expiring tokens for approved non-browser APIs with one-time secret display, metadata and revoke. Current Policies apply in both modes. Personal tokens cannot manage tokens or call admin APIs.

Khai owns setup/schema/configuration in RNT-01. Hien owns account/token screens and APIs/tests in RNT-03. All feature owners protect their browser forms; Khai verifies integrated security in RNT-13. No extra micro-issues or mandatory E2E suite.

Tradeoffs: configure sibling subdomains or a tested same-origin proxy, credentialed CORS, mail and session storage. Existing accounts require an explicit UUID-preserving migration and secure reset/reverification procedure; no destructive reset is authorized by this decision.

Implementation, defaults and official references: [authentication setup](../authentication-setup.md).
