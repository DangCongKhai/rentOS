<!-- rentos-backlog-v2: RNT-02 -->

# RNT-02: Manage properties, units, photos, amenities and owner listings

## Outcome

Owners create and edit properties, units, photos and amenities, then separately create, submit and publish their rental listings.

## Ownership and order

- Phase 1.
- Implementation: **Kien** (frontend + backend + own tests).
- Reviewer: **Khai**.
- Prerequisites: [RNT-01](RNT-01.md), [RNT-03](RNT-03.md), [RNT-04](RNT-04.md).
- Publication: Draft; actual GitHub issue URL not recorded.

Dependencies gate final integration; fixtures and agreed contracts allow earlier independent work. This remains one grouped issue with internal checklists and multiple PRs if useful.

## Functional requirements

- **FR07 — Create property draft without moderation** (P0 Must): Owner creates physical property, address, amenities and controlled policies. WHOLE_SPACE atomically creates one backend unit; SEPARATE_UNITS uses explicit unit creation. Incomplete drafts can be saved. No property approval state or mandatory ownership evidence/phone verification in MVP. Amenities use properties.shared_amenities JSONB with schema_version, allowlisted standard key/object entries and custom text array; select or add custom features directly in the property form (FR87).
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr07)
- **FR08 — Manage and archive own property** (P0 Must): Owner edits own property and archives unused resources. Existing tenancy, request, contract and audit references are preserved. Archive prevents new marketing/proposals but does not erase active agreements.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr08)
- **FR09 — Upload property and unit photos** (P0 Must): Upload validated images and create one property_media row with optional same-property unit_id. No review_status, approval, replacement chain or admin photo queue. Upload completes before media becomes selectable. Initial listing review sees selected photos; later additions appear directly when selected on an eligible listing.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr09)
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
- **FR60 — Manage controlled property JSONB policies** (P0 Must): properties.policies contains schema_version, defaults for predefined pets/smoking, and shared_rules array. Owner uses form fields; backend validates allowlisted keys/enums and limits. No independent policy table in MVP; later migration can preserve stable keys. Approved listings update immediately with audit.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr60)
- **FR61 — Resolve unit policy overrides and additional rules** (P0 Must): units.policy_overrides contains optional predefined enum overrides and additional_rules array. Missing key inherits property default; shared_rules always retained. Preserve resolved actually agreed policies in immutable version snapshot at proposal, editable only through new version.
  - [All 4 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr61)
- **FR87 — Manage consistent standard and custom amenities** (P0 Must): Owners select standard amenities or add custom text directly in Create/Edit Property and Unit forms. Laravel owns a code-managed catalog with stable keys, localized canonical labels, explicit aliases and allowed PROPERTY/UNIT scopes, exposed through GET /amenities. Both amenity columns use controlled JSONB {schema_version:1,standard:{key:{enabled:boolean,details?:text}},custom:[text]}. Standard search matches canonical key and enabled=true; custom text is descriptive only. Backend allowlist/type/limit validation; NFC+trim+whitespace normalization for custom display, case folding only for local duplicate detection. No automatic global slug creation, semantic synonym inference, owner_label or amenity tables in MVP. Catalog changes later require explicit migrations only if keys/meaning change.
  - [All 10 acceptance cases](../../docs/06-acceptance/test-scenarios.md#fr87)
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

## Backend deliverables

- [ ] Implement own-property/unit CRUD and archive, WHOLE_SPACE automatic unit and separate/bulk units with unique labels and independent READY/MAINTENANCE/RETIRED operational state.
- [ ] Implement actual Supabase Storage upload initiation/completion, byte/MIME/size/count validation, same-property unit linkage, selected photos/cover/reordering and immutable object paths. Persist only completed uploads; audit resource changes atomically.
- [ ] Implement property policy defaults/shared_rules and unit overrides/additional_rules. Amenities use code-managed canonical catalog/scopes and JSONB schema_version/standard/custom; NFC/trim/whitespace and local case-fold dedup preserve accents and never create global custom keys.
- [ ] Implement listing draft/edit, complete first-package submission, publication/hide/archive and one current listing per property. Reuse existing property/unit/media/policy data.
- [ ] Centralize public visibility: initial approval, owner publication, no suspension/archive and valid resources. After initial approval, valid content edits are direct and audited; before approval, edits invalidate submitted revisions.

## Frontend deliverables

- [ ] Build owner property and unit create/edit/archive screens, bulk preview/editor, photos upload/reorder/remove and policy/amenity forms.
- [ ] Keep property creation separate from listing creation; support incomplete drafts, responsive layouts, upload progress, field/revision errors and shared versus private amenity labels.
- [ ] Build separate owner listing draft, submit and publication controls after property/unit management; show independent review and publication states.

## Acceptance criteria

- [ ] Creating a WHOLE_SPACE property saves exactly one auto-unit atomically; draft incompleteness is allowed until listing submission.
- [ ] Foreign references, duplicate labels, stale updates and forged owners fail; bulk/create retries do not duplicate properties and units.
- [ ] Operational status never substitutes for date-based availability and cannot erase active agreement history.
- [ ] Only completed valid media in the same property scope can be selected; cover replacement remains valid; no image approval/replacement-status workflow exists.
- [ ] Unknown standard amenity keys/bad JSON types fail; custom spelling does not fragment global filters; current advertising edits never mutate agreed contract snapshots.
- [ ] The actual Storage API success and redacted failure path are demonstrated and every successful change has the expected audit outcome.
- [ ] Creating property never automatically submits/publishes a listing; incomplete draft saves but cannot pass complete submission/publication checks.
- [ ] First admin approval is required once; later valid edits do not request reapproval and cannot clear admin suspension.
- [ ] Property creation and listing creation use separate screens and actions. An owner can hide/archive their listing; an admin suspension cannot be cleared by editing or publishing it.

## Tests/evidence owned by this member

- [ ] Unit tests for normalization, policy resolution, term validation and form interactions.
- [ ] PostgreSQL/API integration tests for ownership, scope, bulk rollback/idempotency, stale edits and archive/allocation races.
- [ ] Frontend component tests for property/unit/photo forms and a real Storage success/failure integration check; manually check changed owner screens.
- [ ] API/component tests and manual UI checks for separate listing create/edit/submit/publish/hide/archive actions, one current listing per property, missing submission fields and updates without reapproval. Integrate first-publication approval with Tri’s RNT-04; complete the owner journey using real APIs.

## NFRs, boundaries and coordination

NFR-01, NFR-02, NFR-03, NFR-04, NFR-07

NFR-01, NFR-02, NFR-03, NFR-04, NFR-07; T3f, T4a, T3g, T4d
Kien owns property/unit/photo management and owner listing creation/publication. Keep Create property and Create listing as separate flows/screens. Tri owns admin approval (RNT-04); Khai owns public landing/search/detail pages and their APIs (RNT-06). Scheduled deletion of unreferenced photo files after retention belongs to RNT-10.

## Definition of done

- [ ] Implement related frontend, backend and meaningful unit/component/API/PostgreSQL integration tests; all feature owners test their own changes.
- [ ] Private routes use auth:sanctum and current account/resource Policies. Browser writes require CSRF; approved PAT endpoints additionally enforce abilities. Session-only endpoints reject PAT-only callers.
- [ ] Update FormRequests/Resources/OpenAPI and explicit frontend types. Future TypeScript generation remains documentation only.
- [ ] Apply transaction/revision/idempotency/audit rules to domain actions. Never store token secrets in replay records. Use reviewed migrations locally; never reset/reseed a hosted environment.
- [ ] Use a short manual changed-screen checklist; no required automated browser/E2E suite.
- [ ] Attach actual test commands/results and relevant evidence; specifications do not prove implementation.

RNT-02 is a planning key, not a GitHub number. Deleted issues are not reused.
