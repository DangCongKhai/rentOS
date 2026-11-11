<!-- rentos-backlog-v2: RNT-14 -->

# RNT-14: Verify owner property/listing/photo actions, remove repeated database queries and reduce image downloads

## Outcome

Verify owner property, unit, photo and listing actions; fix reproducible errors; remove repeated database lookups and avoid downloading full-resolution photos for small cards.

## Ownership and order

- Phase 4.
- Implementation: **Kien** (frontend + backend + own tests).
- Reviewer: **Hien**.
- Prerequisites: [RNT-02](RNT-02.md), [RNT-06](RNT-06.md), [RNT-10](RNT-10.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR07 — Create property draft without moderation** (P0 Must): Owner creates physical property, address, amenities and controlled policies. WHOLE_SPACE atomically creates one backend unit; SEPARATE_UNITS uses explicit unit creation. Incomplete drafts can be saved. No property approval state or mandatory ownership evidence/phone verification in MVP. Amenities use properties.shared_amenities JSONB with schema_version, allowlisted standard key/object entries and custom text array; select or add custom features directly in the property form (FR87).
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr07)
- **FR08 — Manage and archive own property** (P0 Must): Owner edits own property and archives unused resources. Existing tenancy, request, contract and audit references are preserved. Archive prevents new marketing/proposals but does not erase active agreements.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr08)
- **FR09 — Upload property and unit photos** (P0 Must): Upload validated images and create one property_media row with optional same-property unit_id. No review_status, approval, replacement chain or admin photo queue. Upload completes before media becomes selectable. Initial listing review sees selected photos; later additions appear directly when selected on an eligible listing.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr09)
- **FR10 — Create property-level listing draft** (P0 Must): Choose own nonarchived property, market selected units, enter title/description and choose cover from existing selected media. Reuse property address/policies and unit specifications/photos. One nonarchived listing per property.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr10)
- **FR11 — Edit listing without reapproval after initial approval** (P0 Must): After first APPROVED decision, owner may update property, units, policies, media and listing wording immediately without resetting approval. Changes are audited and remain reportable. Edits before approval invalidate the submitted content revision. Admin suspension is independent and cannot be cleared by an edit.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr11)
- **FR12 — Submit initial listing package** (P0 Must): First publication requires admin review of listing plus linked property, marketed units, selected media and policies as one package. Validate required address, unit details, at least one shared photo and photo per marketed unit. Capture property content_revision and listing submitted_revision. Rejected initial submissions may be corrected/resubmitted.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr12)
- **FR17 — Publish initially approved listing** (P0 Must): Owner may publish only an initially approved, nonarchived, complete listing belonging to a nonarchived property and not admin-suspended. Require at least one READY, marketed unit with availability for the selected date query. Search without dates defaults to today for the unit minimum duration. No property/image approval conditions.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr17)
- **FR18 — Hide or archive listing** (P0 Must): Owner can hide or archive own listing. Admin suspension is a separate control with required reason. Republishing an owner-hidden listing retains initial approval and must pass current eligibility; owner cannot remove admin suspension.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr18)
- **FR41 — Property and unit REST CRUD** (P0 Must): Authorize owner-scoped CRUD for properties, units and gallery selection. Route linked-content writes through property content lock/revision/audit action. No property approval, document-evidence review or image-review endpoints.
  - [All 3 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr41)
- **FR50 — Create and bulk create units** (P0 Must): SEPARATE_UNITS allows manual or structured bulk creation: count, prefix, starting number and defaults. Generate editable preview rows in Next.js; save final JSON array transactionally. No LLM/SQL generation. Unit amenity defaults use the same controlled JSONB structure as FR87; each preview row gets its own copied value, not linked mutable defaults.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr50)
- **FR51 — Edit unit details and advertised terms** (P0 Must): Owner edits specifications, marketed price/deposit, minimum duration and controlled policy overrides. Valid post-approval edits appear directly with audit; current or proposed contract snapshots are immutable. Unit amenities use units.amenities with allowlisted scope-aware catalog keys and custom text per FR87; no owner-created global amenity key.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr51)
- **FR52 — Manage operational status independently of availability** (P0 Must): units.operational_status is READY, MAINTENANCE or RETIRED. Rental availability is derived for a requested interval from blocking tenancy ranges, not an OCCUPIED flag. is_marketed controls advertisement only. Maintenance stops new proposals but does not cancel agreements.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr52)
- **FR55 — Audit property unit and policy updates** (P0 Must): Increment property.content_revision for changes to any initial-review content, including units, selected photos and policies. Before first approval invalidate pending snapshot. After approval retain approval and show changes directly; append safe audit before/after with actor/time. Amenity changes increment property content_revision, retain normal post-approval editing and record before/after audit. Standard label changes in the code catalog do not rewrite saved keys (FR87).
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr55)
- **FR56 — Select reorder and remove gallery images** (P0 Must): Owner selects media, sets order and cover, or soft-deletes unused photos. Selected nondeleted property/unit media may appear without review. Cover must be selected, same-property shared media; deleting cover requires replacement or explicit hide.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr56)
- **FR57 — Update photos without a replacement-review workflow** (P0 Must): To change photo bytes, upload a new object/media row and switch gallery/cover references in a transaction after upload succeeds; optionally soft-delete old media. No replaces_image_id, image approvals or waiting-choice dialog.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr57)
- **FR59 — Delete unreferenced photo files after retention** (P1 Should): A scheduled job deletes stored photo files left by abandoned uploads or owner removals only after the configured retention period. Recheck all live property/unit/cover and retained-history references immediately before deletion. Preserve referenced files. Contract documents are excluded from this job.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr59)
- **FR60 — Manage controlled property JSONB policies** (P0 Must): properties.policies contains schema_version, defaults for predefined pets/smoking, and shared_rules array. Owner uses form fields; backend validates allowlisted keys/enums and limits. No independent policy table in MVP; later migration can preserve stable keys. Approved listings update immediately with audit.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr60)
- **FR61 — Resolve unit policy overrides and additional rules** (P0 Must): units.policy_overrides contains optional predefined enum overrides and additional_rules array. Missing key inherits property default; shared_rules always retained. Preserve resolved actually agreed policies in immutable version snapshot at proposal, editable only through new version.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr61)
- **FR87 — Manage consistent standard and custom amenities** (P0 Must): Owners select standard amenities or add custom text directly in Create/Edit Property and Unit forms. Laravel owns a code-managed catalog with stable keys, localized canonical labels, explicit aliases and allowed PROPERTY/UNIT scopes, exposed through GET /amenities. Both amenity columns use controlled JSONB {schema_version:1,standard:{key:{enabled:boolean,details?:text}},custom:[text]}. Standard search matches canonical key and enabled=true; custom text is descriptive only. Backend allowlist/type/limit validation; NFC+trim+whitespace normalization for custom display, case folding only for local duplicate detection. No automatic global slug creation, semantic synonym inference, owner_label or amenity tables in MVP. Catalog changes later require explicit migrations only if keys/meaning change.
  - [All 10 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr87)

## Backend deliverables

- [ ] Inspect query counts/plans for owner property and unit/listing lists on a fixed seeded dataset. Replace repeated per-row relationship queries with eager loading, paginate collection endpoints, and add an index only where a query plan demonstrates the need. Record before/after counts and the same test inputs.
- [ ] Test separate property/unit/listing create/edit/archive/submit/publish actions, concurrent admin suspension and stale revision rejection. Editing advertised data must preserve previously agreed contract snapshots.
- [ ] Test Storage upload failure/retry and the scheduled deletion rules from RNT-10. Record actual successful/failed provider calls without secrets; a referenced photo must survive owner edits and deletion-job retries.

## Frontend deliverables

- [ ] Check owner bulk unit forms, photo upload/reorder/remove, property policies and listing forms on mobile/desktop. Fix reproducible validation, retry, stale-revision and unsaved-input errors, with component regression tests.
- [ ] Use appropriately sized responsive photos for cards/previews and load below-the-fold photos only when needed. Verify actual image dimensions and downloaded bytes in browser developer tools; do not add an AI thumbnail service.

## Acceptance criteria

- [ ] API integration tests cover whole-space/multi-unit property edits, separate listing creation/publication, failed upload retries and stale revisions. Record a short manual UI checklist; no automated browser suite is required.
- [ ] Editing a published listing preserves initial approval and audit history, cannot remove admin suspension and cannot change agreed contract snapshots.
- [ ] Owner list endpoints paginate results; relationship loading does not add one repeated query per returned unit. Include before/after query counts and query plans for the same seeded inputs.
- [ ] Photo cards/previews request display-appropriate image sizes; below-the-fold photos are deferred. Record requested dimensions and downloaded bytes before/after the change rather than claiming an unspecified speed improvement.
- [ ] Storage/worker integration tests cover upload/removal retries and concurrent reference changes; referenced cover/history photos are never deleted.
- [ ] Add unit/component/API regression tests for the defects fixed here. Required tests, lint/typecheck and coverage checks pass; include actual commands/results.

## Tests/evidence owned by this member

- [ ] Unit/component tests for bulk-form validation, upload failure/retry, reordered/removed photo state, stale-revision recovery and unsaved input.
- [ ] PostgreSQL/API/worker/Storage integration tests for property/unit/listing actions, authorization, snapshot preservation, failed provider calls and concurrent photo-reference changes.
- [ ] Capture query counts/plans and image dimensions/bytes using the same seed and viewport before/after changes. Manually check the affected owner screens; automated browser/E2E tests are outside required scope.

## NFRs, boundaries and coordination

NFR-01, NFR-02, NFR-03, NFR-04, NFR-06, NFR-07

NFR-01, NFR-02, NFR-03, NFR-04, NFR-06, NFR-07; T3f, T6b, T6d, T3g, T4d
Kien verifies and fixes the owner features from RNT-02/RNT-10 here. Public search caching belongs to Hien in RNT-11 and public browsing UI to Khai in RNT-06. No new search platform, map feature or AI image service; no invented latency target or automated browser-test requirement.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-14 is a planning key, not a GitHub number. Deleted issues are not reused.
