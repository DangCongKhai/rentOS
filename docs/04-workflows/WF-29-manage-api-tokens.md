# WF-29 Create, use and revoke personal API tokens

Actors: verified user; Next.js settings; non-browser API client; Laravel. Requirements: FR05 FR43 FR89 FR90.

## Main flow

1. Open Settings > API tokens using an active browser session. List only this account’s token name, scopes, created/last-used/expiry and computed active/expired status.
2. Confirm the current password, choose a name, allowed scopes and expiry, then submit with CSRF. Server validates all fields and stores only a token hash with user UUID, abilities and finite expiry.
3. Show the plaintext secret once with Copy and a warning that it cannot be retrieved later. Keep the response no-store; no generic replay/cache/log persistence.
4. Use the token in `Authorization: Bearer ...` from a cookie-free tool. Supported routes enforce account:read or favourites:read/write and current Policies.
5. Confirm Revoke in the browser. Server scopes deletion to the current user; subsequent bearer requests return 401. Rotation is explicitly create a replacement then revoke the old token.

## Failure and security rules

No PAT-only token management or admin access. Reject unknown/wildcard/admin scopes and foreign IDs. If a create response is lost, refresh metadata, revoke the inaccessible token and explicitly create another; never return a stored plaintext secret. Ordinary logout does not revoke PATs; successful password reset/change or suspension revokes all sessions/PATs.

## Evidence

Frontend component tests and real API/PostgreSQL token tests prove hash storage, one-time display, read-only write denial, CSRF rejection, expiry and revocation. Manual settings and curl/Postman checks suffice for UI demonstration; automated browser/E2E tests are not required.
