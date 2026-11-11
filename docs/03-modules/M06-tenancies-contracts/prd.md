# Tenancy proposals, immutable agreements and lifecycle — PRD

## Outcome

One tenancy is a tenant–unit relationship; tenancy_contracts stores multiple immutable submitted versions with embedded write-once acknowledgements.

## Scope and screens/actions

- Proposal reserves the exact unit/date interval while PENDING_CONFIRMATION; owner explicitly acknowledges the submitted UUID/hash.
- Tenant confirms or declines that same current version before its deadline. Correction appends a new row, requires fresh acknowledgements and reacquires availability.
- Owner records move-in/end/cancellation explicitly. PostgreSQL exclusion, FKs and deferred consistency checks enforce invariants even under concurrent SQL; do not infer move-out from calendar expiry.

## Functional requirements

### FR33 — Enforce nonoverlapping unit rental periods

**Priority:** P0 Must. **Actors:** System. **Delivery:** Primary: RNT-05.

PostgreSQL GiST exclusion constraint on tenancies(unit_id, daterange(blocked_start_date, blocked_end_date+1, [))) for PENDING_CONFIRMATION/CONFIRMED/ACTIVE. Different nonoverlapping future tenancies on one unit are permitted. Blocking envelope includes confirmed span plus any proposed renewal extension.

Acceptance: [5 cases for FR33](../../06-acceptance/test-scenarios.md#fr33); IDs FR33-AC01, FR33-AC02, FR33-AC03, FR33-AC04, FR33-AC05.

### FR34 — Create tenancy proposal with temporary reservation

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-05.

Owner chooses exact READY nonarchived unit in request property, enters final dates/rent/deposit, negotiated policy snapshot and private agreement document, then explicitly confirms version. Create one continuing tenancy with version 1, pending pointer and configured confirmation deadline. Default reservation 48h is a proposed configurable setting.

Acceptance: [5 cases for FR34](../../06-acceptance/test-scenarios.md#fr34); IDs FR34-AC01, FR34-AC02, FR34-AC03, FR34-AC04, FR34-AC05.

### FR35 — View tenancy timeline and contract versions

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-05.

Owner and tenant can view all immutable version metadata/documents, each party confirmation/decline, proposed/current/upcoming terms, deadline and supersession links. Derive state from current pending pointer, confirmations and audit events; do not mark old versions confirmed by inference.

Acceptance: [4 cases for FR35](../../06-acceptance/test-scenarios.md#fr35); IDs FR35-AC01, FR35-AC02, FR35-AC03, FR35-AC04.

### FR42 — Rental request tenancy and renewal action APIs

**Priority:** P0 Must. **Actors:** Tenant; Owner. **Delivery:** Primary: RNT-05.

Provide authenticated request submit/withdraw/reject, tenancy propose/correct/cancel/end/move-in, exact-version confirm/decline and renewal request/propose actions. Shared actions enforce policies, idempotency and transaction rules. No viewings endpoints.

Acceptance: [4 cases for FR42](../../06-acceptance/test-scenarios.md#fr42); IDs FR42-AC01, FR42-AC02, FR42-AC03, FR42-AC04.

### FR66 — Cancel proposals and end confirmed tenancies

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-05.

Initial proposal decline releases reservation and sets AWAITING_REVISION; owner may issue corrected version under same tenancy after rechecking availability. Expired initial proposal becomes EXPIRED. Owner may cancel pre-start confirmed tenancy or record actual end with reason; preserve accepted rental request/history and immutable agreements. Ending cancels pending renewal work and releases only the remaining blocked portion.

Acceptance: [5 cases for FR66](../../06-acceptance/test-scenarios.md#fr66); IDs FR66-AC01, FR66-AC02, FR66-AC03, FR66-AC04, FR66-AC05.

### FR67 — Record original immutable agreement version

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-05.

Store version_number, ORIGINAL type, dates/rent/deposit, negotiated policies, private unique document_path, SHA256, optional owner-reported signed_on and created_by/created_at. No signing service. Owner explicitly confirms exact version on submit; tenant must independently confirm same UUID/hash. Store owner_confirmed_at, tenant_confirmed_at, tenant_rejected_at and tenant_rejection_reason on tenancy_contracts; there is no separate confirmation entity.

Acceptance: [4 cases for FR67](../../06-acceptance/test-scenarios.md#fr67); IDs FR67-AC01, FR67-AC02, FR67-AC03, FR67-AC04.

### FR71 — Keep immutable versions and effective agreement history

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-05.

tenancy_contracts stores immutable submitted agreement versions, agreed terms/document/hash and write-once participant confirmation metadata. ORIGINAL and consecutive RENEWAL segments represent agreed periods; corrections create new rows with supersedes_contract_id. Current agreed rent comes only from the mutually confirmed segment covering the date. No separate contract_confirmations table. Confirmed mid-term amendments remain deferred.

Acceptance: [4 cases for FR71](../../06-acceptance/test-scenarios.md#fr71); IDs FR71-AC01, FR71-AC02, FR71-AC03, FR71-AC04.

### FR74 — Idempotent writes and stale revisions

**Priority:** P0 Must. **Actors:** System. **Delivery:** Primary: RNT-01.

Use client_operation_id UUID on creates and revision checks on mutable resources. Scope operation key to actor/parent. Reusing key with different canonical payload returns409; terminal action replay never repeats side effects.

Acceptance: [4 cases for FR74](../../06-acceptance/test-scenarios.md#fr74); IDs FR74-AC01, FR74-AC02, FR74-AC03, FR74-AC04.

### FR75 — Transactional locking audit and consistency

**Priority:** P0 Must. **Actors:** System. **Delivery:** Primary: RNT-01.

All writes use shared Laravel actions, fixed lock order property then units sorted by UUID then rental request/tenancy/renewal rows. Persist domain/audit/outbox/idempotency in same transaction. Direct clients cannot write application tables. Cross-table invariants use composite FKs and deferred constraint triggers as specified.

Acceptance: [4 cases for FR75](../../06-acceptance/test-scenarios.md#fr75); IDs FR75-AC01, FR75-AC02, FR75-AC03, FR75-AC04.

### FR80 — Confirm move-in after mutual contract confirmation

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-05.

Owner records move-in on/after first confirmed start date for CONFIRMED tenancy, changes to ACTIVE and audits. PENDING_CONFIRMATION never activates on date arrival. Future nonoverlapping tenancies remain permitted; activation does not extend blocked range.

Acceptance: [4 cases for FR80](../../06-acceptance/test-scenarios.md#fr80); IDs FR80-AC01, FR80-AC02, FR80-AC03, FR80-AC04.

### FR81 — Confirm the exact contract version mutually

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-05.

Both parties acknowledge the same tenancy_contracts.id and immutable document_sha256. owner_confirmed_at is set only through explicit owner submission; tenant_confirmed_at is set once by the related tenant before deadline on the current pending contract. Tenant may instead set tenant_rejected_at with reason, never both outcomes. The final confirmation promotes confirmed dates and clears the pending pointer/deadline atomically. A new contract version requires fresh confirmation fields.

Acceptance: [6 cases for FR81](../../06-acceptance/test-scenarios.md#fr81); IDs FR81-AC01, FR81-AC02, FR81-AC03, FR81-AC04, FR81-AC05, FR81-AC06.

### FR82 — Decline and correct unconfirmed versions

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-05.

Tenant can decline exact current version with reason. Initial tenancy becomes AWAITING_REVISION and releases hold; renewal decline keeps confirmed tenancy/range and request PENDING. Owner creates corrected immutable version linked to superseded version, obtains new explicit owner confirmation and new reservation/deadline after rechecking availability. No correction of already mutually confirmed terms in MVP.

Acceptance: [5 cases for FR82](../../06-acceptance/test-scenarios.md#fr82); IDs FR82-AC01, FR82-AC02, FR82-AC03, FR82-AC04, FR82-AC05.

### FR83 — Expire temporary confirmation reservations

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-09.

Store confirmation_expires_at using server clock; proposed default48h configurable. Scheduler scans due holds and action paths reap them under locks. No now() in exclusion predicate. Initial expiry sets EXPIRED and clears hold; pending renewal expiry restores confirmed envelope, clears pending pointer and leaves renewal request PENDING for discussion. Accepted rental request history stays accepted.

Acceptance: [5 cases for FR83](../../06-acceptance/test-scenarios.md#fr83); IDs FR83-AC01, FR83-AC02, FR83-AC03, FR83-AC04, FR83-AC05.

### FR86 — Enforce immutable contract terms and write-once confirmations

**Priority:** P0 Must. **Actors:** Owner; Tenant. **Delivery:** Primary: RNT-05.

Database triggers protect tenancy_contracts terms/document/hash from update/delete while permitting one authorized null-to-value tenant confirmation or rejection update. Existing confirmation timestamps and reasons cannot be overwritten. Composite FKs keep pending/latest/superseded/basis contract references in the same tenancy. Deferred invariant checks enforce exact-contract mutual confirmation, request outcomes and date projections. No separate confirmation table.

Acceptance: [5 cases for FR86](../../06-acceptance/test-scenarios.md#fr86); IDs FR86-AC01, FR86-AC02, FR86-AC03, FR86-AC04, FR86-AC05.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
