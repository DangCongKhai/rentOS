# M01-identity-access: Identity, profiles and API permissions

Register and sign in through Fortify. Next.js uses Sanctum browser sessions and CSRF. Settings > API tokens manages independent scoped expiring personal tokens. Current resource/admin Policies apply to both modes.

Read the [PRD](prd.md), [domain rules](../../02-domain/business-rules.md) and [traceability matrix](../../06-acceptance/traceability-matrix.md).

Primary contributors: Hien. Ownership is per complete issue, not a separate frontend/backend allocation.

- [RNT-03](../../../planning/issues/RNT-03.md) — Hien
- [RNT-13](../../../planning/issues/RNT-13.md) — Khai

Implementation guide: [Fortify/Sanctum setup](../../07-architecture/authentication-setup.md). FR89 and FR90 belong to RNT-03; RNT-13 verifies integrated security.

