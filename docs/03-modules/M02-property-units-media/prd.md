# Property, unit, photo, policy and amenity management — PRD

## Outcome

Owners manage physical properties and independently rentable units before separately creating public listings.

## Scope and screens/actions

- WHOLE_SPACE creates one backend unit atomically; SEPARATE_UNITS supports explicit/bulk unique labels.
- Validate completed uploads and property/unit scope; photos have no approval/replacement-review status. Delete unreferenced stored photo files only after retention and a final reference check.
- Operational READY/MAINTENANCE/RETIRED is separate from date availability; controlled standard/custom JSONB amenities and inherited advertised policies.

## Functional requirements

### FR07 — Create property draft without moderation

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

Owner creates physical property, address, amenities and controlled policies. WHOLE_SPACE atomically creates one backend unit; SEPARATE_UNITS uses explicit unit creation. Incomplete drafts can be saved. No property approval state or mandatory ownership evidence/phone verification in MVP. Amenities use properties.shared_amenities JSONB with schema_version, allowlisted standard key/object entries and custom text array; select or add custom features directly in the property form (FR87).

Acceptance: [4 cases for FR07](../../06-acceptance/test-scenarios.md#fr07); IDs FR07-AC01, FR07-AC02, FR07-AC03, FR07-AC04.

### FR08 — Manage and archive own property

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

Owner edits own property and archives unused resources. Existing tenancy, request, contract and audit references are preserved. Archive prevents new marketing/proposals but does not erase active agreements.

Acceptance: [4 cases for FR08](../../06-acceptance/test-scenarios.md#fr08); IDs FR08-AC01, FR08-AC02, FR08-AC03, FR08-AC04.

### FR09 — Upload property and unit photos

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

Upload validated images and create one property_media row with optional same-property unit_id. No review_status, approval, replacement chain or admin photo queue. Upload completes before media becomes selectable. Initial listing review sees selected photos; later additions appear directly when selected on an eligible listing.

Acceptance: [4 cases for FR09](../../06-acceptance/test-scenarios.md#fr09); IDs FR09-AC01, FR09-AC02, FR09-AC03, FR09-AC04.

### FR41 — Property and unit REST CRUD

**Priority:** P0 Must. **Actors:** Owner; Admin where explicitly allowed. **Delivery:** Primary: RNT-02.

Authorize owner-scoped CRUD for properties, units and photos selection. Route linked-content writes through property content lock/revision/audit action. No property approval, document-evidence review or image-review endpoints.

Acceptance: [3 cases for FR41](../../06-acceptance/test-scenarios.md#fr41); IDs FR41-AC01, FR41-AC02, FR41-AC03.

### FR50 — Create and bulk create units

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

SEPARATE_UNITS allows manual or structured bulk creation: count, prefix, starting number and defaults. Generate editable preview rows in Next.js; save final JSON array transactionally. No LLM/SQL generation. Unit amenity defaults use the same controlled JSONB structure as FR87; each preview row gets its own copied value, not linked mutable defaults.

Acceptance: [4 cases for FR50](../../06-acceptance/test-scenarios.md#fr50); IDs FR50-AC01, FR50-AC02, FR50-AC03, FR50-AC04.

### FR51 — Edit unit details and advertised terms

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

Owner edits specifications, marketed price/deposit, minimum duration and controlled policy overrides. Valid post-approval edits appear directly with audit; current or proposed contract snapshots are immutable. Unit amenities use units.amenities with allowlisted scope-aware catalog keys and custom text per FR87; no owner-created global amenity key.

Acceptance: [4 cases for FR51](../../06-acceptance/test-scenarios.md#fr51); IDs FR51-AC01, FR51-AC02, FR51-AC03, FR51-AC04.

### FR52 — Manage operational status independently of availability

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

units.operational_status is READY, MAINTENANCE or RETIRED. Rental availability is derived for a requested interval from blocking tenancy ranges, not an OCCUPIED flag. is_marketed controls advertisement only. Maintenance stops new proposals but does not cancel agreements.

Acceptance: [4 cases for FR52](../../06-acceptance/test-scenarios.md#fr52); IDs FR52-AC01, FR52-AC02, FR52-AC03, FR52-AC04.

### FR55 — Audit property unit and policy updates

**Priority:** P0 Must. **Actors:** Owner; System. **Delivery:** Primary: RNT-02.

Increment property.content_revision for changes to any initial-review content, including units, selected photos and policies. Before first approval invalidate pending snapshot. After approval retain approval and show changes directly; append safe audit before/after with actor/time. Amenity changes increment property content_revision, retain normal post-approval editing and record before/after audit. Standard label changes in the code catalog do not rewrite saved keys (FR87).

Acceptance: [4 cases for FR55](../../06-acceptance/test-scenarios.md#fr55); IDs FR55-AC01, FR55-AC02, FR55-AC03, FR55-AC04.

### FR56 — Select reorder and remove photos images

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

Owner selects media, sets order and cover, or soft-deletes unused photos. Selected nondeleted property/unit media may appear without review. Cover must be selected, same-property shared media; deleting cover requires replacement or explicit hide.

Acceptance: [4 cases for FR56](../../06-acceptance/test-scenarios.md#fr56); IDs FR56-AC01, FR56-AC02, FR56-AC03, FR56-AC04.

### FR57 — Update photos without a replacement-review workflow

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

To change photo bytes, upload a new object/media row and switch photos/cover references in a transaction after upload succeeds; optionally soft-delete old media. No replaces_image_id, image approvals or waiting-choice dialog.

Acceptance: [4 cases for FR57](../../06-acceptance/test-scenarios.md#fr57); IDs FR57-AC01, FR57-AC02, FR57-AC03, FR57-AC04.

### FR59 — Delete unreferenced photo files after retention

**Priority:** P1 Should. **Actors:** System. **Delivery:** Primary: RNT-10.

A scheduled job deletes stored photo files left by abandoned uploads or owner removals only after the configured retention period. Recheck all live property/unit/cover and retained-history references immediately before deletion. Preserve referenced files. Contract documents are excluded from this job.

Acceptance: [4 cases for FR59](../../06-acceptance/test-scenarios.md#fr59); IDs FR59-AC01, FR59-AC02, FR59-AC03, FR59-AC04.

### FR60 — Manage controlled property JSONB policies

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

properties.policies contains schema_version, defaults for predefined pets/smoking, and shared_rules array. Owner uses form fields; backend validates allowlisted keys/enums and limits. No independent policy table in MVP; later migration can preserve stable keys. Approved listings update immediately with audit.

Acceptance: [4 cases for FR60](../../06-acceptance/test-scenarios.md#fr60); IDs FR60-AC01, FR60-AC02, FR60-AC03, FR60-AC04.

### FR61 — Resolve unit policy overrides and additional rules

**Priority:** P0 Must. **Actors:** Owner; Guest; Tenant. **Delivery:** Primary: RNT-02.

units.policy_overrides contains optional predefined enum overrides and additional_rules array. Missing key inherits property default; shared_rules always retained. Preserve resolved actually agreed policies in immutable version snapshot at proposal, editable only through new version.

Acceptance: [4 cases for FR61](../../06-acceptance/test-scenarios.md#fr61); IDs FR61-AC01, FR61-AC02, FR61-AC03, FR61-AC04.

### FR87 — Manage consistent standard and custom amenities

**Priority:** P0 Must. **Actors:** Owner; Guest; System. **Delivery:** Primary: RNT-02.

Owners select standard amenities or add custom text directly in Create/Edit Property and Unit forms. Laravel owns a code-managed catalog with stable keys, localized canonical labels, explicit aliases and allowed PROPERTY/UNIT scopes, exposed through GET /amenities. Both amenity columns use controlled JSONB {schema_version:1,standard:{key:{enabled:boolean,details?:text}},custom:[text]}. Standard search matches canonical key and enabled=true; custom text is descriptive only. Backend allowlist/type/limit validation; NFC+trim+whitespace normalization for custom display, case folding only for local duplicate detection. No automatic global slug creation, semantic synonym inference, owner_label or amenity tables in MVP. Catalog changes later require explicit migrations only if keys/meaning change.

Acceptance: [10 cases for FR87](../../06-acceptance/test-scenarios.md#fr87); IDs FR87-AC01, FR87-AC02, FR87-AC03, FR87-AC04, FR87-AC05, FR87-AC06, FR87-AC07, FR87-AC08, FR87-AC09, FR87-AC10.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
