# Owner listings and initial admin approval — PRD

## Outcome

Create listing is a separate action from Create property. First publication requires one complete-package admin approval.

## Scope and screens/actions

- Draft/edit/submit/publish/hide/archive owner screens and APIs; at most one current listing per property.
- Admin reviews exact submitted property/listing content revisions with all advertised units/photos/policies. Rejection requires a reason.
- After initial approval, valid updates are direct and audited. Owner edits never clear independent admin suspension; restore never republishes owner-hidden content.

## Functional requirements

### FR10 — Create property-level listing draft

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

Choose own nonarchived property, market selected units, enter title/description and choose cover from existing selected media. Reuse property address/policies and unit specifications/photos. One nonarchived listing per property.

Acceptance: [4 cases for FR10](../../06-acceptance/test-scenarios.md#fr10); IDs FR10-AC01, FR10-AC02, FR10-AC03, FR10-AC04.

### FR11 — Edit listing without reapproval after initial approval

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

After first APPROVED decision, owner may update property, units, policies, media and listing wording immediately without resetting approval. Changes are audited and remain reportable. Edits before approval invalidate the submitted content revision. Admin suspension is independent and cannot be cleared by an edit.

Acceptance: [4 cases for FR11](../../06-acceptance/test-scenarios.md#fr11); IDs FR11-AC01, FR11-AC02, FR11-AC03, FR11-AC04.

### FR12 — Submit initial listing package

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

First publication requires admin review of listing plus linked property, marketed units, selected media and policies as one package. Validate required address, unit details, at least one shared photo and photo per marketed unit. Capture property content_revision and listing submitted_revision. Rejected initial submissions may be corrected/resubmitted.

Acceptance: [4 cases for FR12](../../06-acceptance/test-scenarios.md#fr12); IDs FR12-AC01, FR12-AC02, FR12-AC03, FR12-AC04.

### FR13 — Review initial listing packages

**Priority:** P0 Must. **Actors:** Admin. **Delivery:** Primary: RNT-04.

Admin queue displays only initial PENDING listings with property/unit details, selected photos, policies and captured revisions. Show owner and completeness; admin approves or rejects with reason.

Acceptance: [3 cases for FR13](../../06-acceptance/test-scenarios.md#fr13); IDs FR13-AC01, FR13-AC02, FR13-AC03.

### FR14 — Approve initial listing package

**Priority:** P0 Must. **Actors:** Admin. **Delivery:** Primary: RNT-04.

Admin approves the exact submitted listing/property content revisions. Store reviewer/time and approved_content_revision. Approval permits publication but does not publish automatically.

Acceptance: [4 cases for FR14](../../06-acceptance/test-scenarios.md#fr14); IDs FR14-AC01, FR14-AC02, FR14-AC03, FR14-AC04.

### FR15 — Reject initial listing with reason

**Priority:** P0 Must. **Actors:** Admin. **Delivery:** Primary: RNT-04.

Admin rejects initial submission with a required reason. Owner corrects data and resubmits; later content violations use suspension rather than resetting initial approval.

Acceptance: [3 cases for FR15](../../06-acceptance/test-scenarios.md#fr15); IDs FR15-AC01, FR15-AC02, FR15-AC03.

### FR16 — Dedicated changes requested state

**Priority:** P2 Defer. **Actors:** Admin. **Delivery:** Deferred — no MVP implementation.

Defer a distinct CHANGES_REQUESTED state. MVP uses rejection with a reason plus edit/resubmit.

Acceptance: [1 cases for FR16](../../06-acceptance/test-scenarios.md#fr16); IDs FR16-AC01.

### FR17 — Publish initially approved listing

**Priority:** P0 Must. **Actors:** Owner. **Delivery:** Primary: RNT-02.

Owner may publish only an initially approved, nonarchived, complete listing belonging to a nonarchived property and not admin-suspended. Require at least one READY, marketed unit with availability for the selected date query. Search without dates defaults to today for the unit minimum duration. No property/image approval conditions.

Acceptance: [4 cases for FR17](../../06-acceptance/test-scenarios.md#fr17); IDs FR17-AC01, FR17-AC02, FR17-AC03, FR17-AC04.

### FR18 — Hide or archive listing

**Priority:** P0 Must. **Actors:** Owner; Admin. **Delivery:** Primary: RNT-02.

Owner can hide or archive own listing. Admin suspension is a separate control with required reason. Republishing an owner-hidden listing retains initial approval and must pass current eligibility; owner cannot remove admin suspension.

Acceptance: [3 cases for FR18](../../06-acceptance/test-scenarios.md#fr18); IDs FR18-AC01, FR18-AC02, FR18-AC03.

## API, validation and failure behavior

Private product routes require `auth:sanctum` and current resource Policies. Browser writes require CSRF; explicitly token-enabled routes additionally require the corresponding PAT ability. Public GET routes serialize safe fields only. Use FormRequests and Resources. Deny forged actors/foreign references; preserve documented 401/403/404/409/422 behavior. Show loading/empty/network/field/revision/session feedback in the related UI.

State-changing domain actions use agreed revision/idempotency/lock order and audit/outbox transaction rules. External storage failure is handled without pretending an upload or queued delivery already completed. See [API design](../../07-architecture/api-design.md).

## Tests and completion

Each feature owner writes meaningful unit/component and API/PostgreSQL integration tests, including denied, invalid, retry/stale and concurrency cases where relevant. Use a short manual checklist for changed screens; automated browser/E2E suites are not required. Record actual commands/results and evidence; current case specifications are not passed tests.
