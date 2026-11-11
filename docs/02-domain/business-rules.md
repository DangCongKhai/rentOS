# Business rules

**BR01.** One current non-archived listing per property; WHOLE_SPACE exactly one auto-unit; do not market whole property and component rooms as separate overlapping properties and units.

**BR02.** Property/image approval is removed. Only initial listing review sees the full linked package; subsequent valid edits remain approved and are audited. Initial stale approval fails under shared content revision lock.

**BR03.** Admin suspension gates all public routes and owner publishing; editing cannot clear it. Admin restoration does not automatically republish an owner-hidden listing.

**BR04.** Public image must be selected, completed, nondeleted and in correct property/unit scope. Replacements are new paths and reference swaps, no image review state or replaces_image_id.

**BR05.** Policies use controlled JSONB defaults/shared_rules and unit overrides/additional_rules. Actual negotiated policy snapshot is stored on each contract; live advertising changes never rewrite it.

**BR06.** Amenities use schema_version/standard/custom; canonical code-managed keys and scope; enabled=true filter; custom NFC/whitespace normalization and local Unicode case-fold dedup. Do not create global slugs from custom text.

**BR07.** One PENDING request per tenant/listing. Submitted contact_name/phone snapshots and desired full interval are private. Discussion stays pending; only successful proposal commits acceptance.

**BR08.** Both parties acknowledge the exact tenancy_contracts UUID/hash; owner confirmation is explicit on submit, tenant acknowledgement/rejection is write-once. New version requires fresh confirmations.

**BR09.** Blocking ranges are finite and ordered. PostgreSQL GiST EXCLUDE guards same-unit overlapping PENDING_CONFIRMATION/CONFIRMED/ACTIVE spans. Adjacent bookings allowed; remove lifetime one-allocated-unit UNIQUE rule.

**BR10.** All properties and units mutation paths share lock order property then units sorted UUID then request/tenancy/renewal. Include bulk additions, maintenance, expiry and15day evaluation, not just proposal endpoint.

**BR11.** Proposed confirmation deadline48h is configurable and not teacher-approved fixed policy. At/after deadline confirm fails; release due holds explicitly, never now() in exclusion predicate.

**BR12.** At age>=15days reject only still-PENDING rental requests with no eligible alternative covering stored desired interval. Preferred unit is soft preference; hidden listing is not proof of occupation.

**BR13.** Renewal is a consecutive new segment under the same tenancy. Pending extension blocks dates but does not change agreed rent/end until mutual confirmation. Many unconfirmed correction rows can share renewal_request_id; it must not be UNIQUE.

**BR14.** Operational READY/MAINTENANCE/RETIRED is separate from rental availability. Contract end does not prove physical move-out; manual overstay operational block is required before further allocation if needed.

**BR15.** New original period follows unit minimum of at least 3 calendar months; rent>0, deposit>=0. Positive consecutive renewal extension is part of continuous tenancy. Do not substitute advertised values for agreed contract terms.

**BR16.** Store success audit/outbox/replay outcome in the same transaction; after-commit workers do not roll back committed business on notification failure. All private links reauthorize.

**BR17.** A favourite is unique(user_id,property_id), private and persisted synchronously. Repeated PUT/DELETE is idempotent. No arbitrary actor from body; row presence does not grant visibility or reserve a unit.

**BR18.** Only visible initially approved owner-published unsuspended nonarchived property/listing content may be returned as a normal favourite card. Saved hidden/suspended/archived targets become generic placeholders; relation/removal persist. Date unavailability alone does not erase the favourite.

**BR19.** Private favourites count counts saved rows, including unavailable placeholders; it is not available-unit count. Badge and hearts use account-scoped cache, not shared public response caching.

**BR20.** One OPEN/REVIEWING report per reporter/listing, authenticated submission, bounded throttling. Admin outcome/rejection/suspension reason required; no automatic takedown solely from report count.

**BR21.** Revision checks prevent lost updates. Retries use scoped operation UUID with payload hash; same key/different payload409. Application DB/storage privileges protect invariants beyond UI convention.
