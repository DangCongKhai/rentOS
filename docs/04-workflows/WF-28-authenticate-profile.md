# WF-28 Register, sign in and manage profile

Actors: Guest; authenticated user; Next.js; Laravel. Requirements: FR01 FR02 FR04 FR05 FR06 FR43 FR49 FR90.

## Preconditions and trigger

RNT-01 Fortify/Sanctum infrastructure, configured database sessions, mail and frontend/API domains. User registers, signs in, verifies email, recovers access or signs out.

## Main flow

1. Next.js fetches `/sanctum/csrf-cookie` with credentials. Submit registration/login with cookies and matching `X-XSRF-TOKEN`.
2. Fortify validates credentials; registration atomically creates users/profile with matching UUID and hashed password. Valid login rotates the session ID and sets its HttpOnly cookie. No personal token is created.
3. Unverified accounts use only limited verification/account routes. After signed email verification, approved product operations are available subject to current Policies.
4. Private browser API requests use `auth:sanctum`. All browser mutations require CSRF; server FormRequests provide 422 field errors. Owner/admin privilege is never taken from submitted fields.
5. Password recovery uses Laravel broker links and allowlisted Next.js pages. Successful reset revokes all sessions/PATs and requires fresh login.
6. CSRF-protected logout invalidates the current browser session, regenerates CSRF and clears account-private queries. Separately created API tokens remain until explicit revoke/expiry.

## Alternatives and failure flows

401 means authentication expired/missing, 403 forbidden, 419 invalid browser CSRF, 422 validation, 429 throttled. Keep safe unsent input and require explicit resubmission after recovery. No token exchange or silent write replay. Failed server logout is not falsely shown as server revocation.

## Postcondition and evidence

One Laravel user/profile account; session access depends on account status and current Policies. Test session rotation/logout, missing/mismatched CSRF and cross-account isolation. Manual UI checks complement unit/component/API integration tests; no required E2E automation. [Token management is separate](WF-29-manage-api-tokens.md).
