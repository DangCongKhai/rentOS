# Acceptance specifications — not executed

All 343 cases are specifications. Unit/component/API/PostgreSQL integration tests plus manual screen checks are required; no automated browser/E2E suite. CSRF tests must explicitly defeat Laravel’s testing bypass. No application tests were run while editing these documents.

## FR01

**Email registration** · P0 Must

### FR01-AC01

- Type: Positive
- Trigger/input: Register valid credentials through Fortify, then verify email
- Expected: One users row and one matching UUID profile exist; password is hashed, is_admin=false; verified user can perform permitted product writes.
- Evidence status: Not executed

### FR01-AC02

- Type: Validation
- Trigger/input: Submit invalid email, weak password or mismatched confirmation
- Expected: 422 field errors; no partial user/profile or privileged account is created.
- Evidence status: Not executed

### FR01-AC03

- Type: Privacy
- Trigger/input: Register an existing normalized email
- Expected: No duplicate account; use the documented generic account-exists/sign-in/reset guidance without private account details.
- Evidence status: Not executed

### FR01-AC04

- Type: Race
- Trigger/input: Two registrations use the same normalized email concurrently
- Expected: Unique constraint and transaction permit one user/profile pair; retries cannot overwrite password, name or admin privilege.
- Evidence status: Not executed

## FR02

**Sign in with a Sanctum browser session** · P0 Must

### FR02-AC01

- Type: Positive
- Trigger/input: Initialize CSRF and log in with valid confirmed-user credentials
- Expected: Session ID is regenerated; cookie-authenticated /api/v1/me succeeds via auth:sanctum; no personal_access_tokens row is created.
- Evidence status: Not executed

### FR02-AC02

- Type: Negative
- Trigger/input: Wrong password or unverified account attempts protected work
- Expected: Wrong credentials fail safely; unverified account can use only the limited verification/account flow and cannot write product data or create tokens.
- Evidence status: Not executed

### FR02-AC03

- Type: Security
- Trigger/input: Session expires while a private page is open
- Expected: API returns 401 (or 419 if CSRF is checked first on a write); clear private client data and request login; do not exchange/refresh provider JWTs or blindly replay writes.
- Evidence status: Not executed

### FR02-AC04

- Type: Negative
- Trigger/input: Repeated login attempts or invalid CSRF
- Expected: Rate limits and CSRF validation reject the attempt; no session is granted. Provide safe retry/login feedback.
- Evidence status: Not executed

## FR03

**Google sign in** · P2 Defer

### FR03-AC01

- Type: Positive
- Trigger/input: Deferred Google callback supplies verified provider identity
- Expected: Explicit safe account linking resolves one Laravel users/profile identity; no duplicate password store.
- Evidence status: Not executed

### FR03-AC02

- Type: Security
- Trigger/input: Invalid callback/state or attempted client-created admin flag
- Expected: Reject flow or ignore forbidden privilege input.
- Evidence status: Not executed

### FR03-AC03

- Type: Race
- Trigger/input: Callback is delivered twice
- Expected: No duplicate profile or duplicated onboarding notification.
- Evidence status: Not executed

## FR04

**Sign out of the browser session** · P0 Must

### FR04-AC01

- Type: Positive
- Trigger/input: User submits logout with valid session and CSRF
- Expected: Current session invalidated and CSRF regenerated; copied prior session cannot read protected data. Private client queries are cancelled/cleared.
- Evidence status: Not executed

### FR04-AC02

- Type: Security
- Trigger/input: Another user signs in on same browser
- Expected: No previous user private data appears.
- Evidence status: Not executed

### FR04-AC03

- Type: Boundary
- Trigger/input: Use an existing personal API token after ordinary browser logout
- Expected: Token continues until its expiry or explicit revocation. UI states this; Settings revoke makes subsequent token replay return 401. Network logout failure is not reported as completed.
- Evidence status: Not executed

## FR05

**Enforce account and resource permissions** · P0 Must

### FR05-AC01

- Type: Security
- Trigger/input: Owner B guesses Owner A property/unit/request UUID
- Expected: Return 403/404 without private data or mutation.
- Evidence status: Not executed

### FR05-AC02

- Type: Security
- Trigger/input: Normal user submits is_admin or another owner_id
- Expected: Reject restricted input; actor comes from verified identity.
- Evidence status: Not executed

### FR05-AC03

- Type: Security
- Trigger/input: Normal user calls an admin moderation endpoint
- Expected: 403; no audit outcome or notification is committed.
- Evidence status: Not executed

### FR05-AC04

- Type: Security
- Trigger/input: Browser directly calls Supabase Data API/storage
- Expected: Business tables are not writable/readable through unintended grants; storage rules restrict private files. Laravel authorization remains enforced even if DB connection bypasses RLS.
- Evidence status: Not executed

## FR06

**Profile and dual dashboards** · P0 Must

### FR06-AC01

- Type: Positive
- Trigger/input: User edits allowed contact fields
- Expected: Validated values saved; dashboard uses current profile.
- Evidence status: Not executed

### FR06-AC02

- Type: Security
- Trigger/input: Profile PATCH includes admin flag, identity UUID or verification fields
- Expected: Rejected; privilege fields unchanged.
- Evidence status: Not executed

### FR06-AC03

- Type: Race
- Trigger/input: Two tabs edit the same profile version
- Expected: Expected version rejects stale write with 409 rather than silently overwriting.
- Evidence status: Not executed

## FR07

**Create property draft without moderation** · P0 Must

### FR07-AC01

- Type: Positive
- Trigger/input: Owner creates whole apartment
- Expected: One property and one Entire apartment unit are saved atomically.
- Evidence status: Not executed

### FR07-AC02

- Type: Validation
- Trigger/input: Owner saves incomplete draft
- Expected: Save permitted; initial listing submission later validates completeness.
- Evidence status: Not executed

### FR07-AC03

- Type: Security
- Trigger/input: Caller supplies owner_id belonging to another user
- Expected: Ignore/reject forged ownership; derive owner from the Sanctum-authenticated profile.
- Evidence status: Not executed

### FR07-AC04

- Type: Race
- Trigger/input: Repeated create with same operation UUID
- Expected: One property/unit result, or 409 if payload changed.
- Evidence status: Not executed

## FR08

**Manage and archive own property** · P0 Must

### FR08-AC01

- Type: Positive
- Trigger/input: Owner archives property
- Expected: Its listing leaves public scope; history remains accessible to participants.
- Evidence status: Not executed

### FR08-AC02

- Type: Security
- Trigger/input: Different owner edits property
- Expected: 403/404 without changing records.
- Evidence status: Not executed

### FR08-AC03

- Type: Race
- Trigger/input: Archive competes with proposal creation
- Expected: Common property lock gives one valid serial outcome; proposal cannot commit against archived property.
- Evidence status: Not executed

### FR08-AC04

- Type: Integrity
- Trigger/input: Property has referenced units or agreements
- Expected: No destructive cascading deletion of business history.
- Evidence status: Not executed

## FR09

**Upload property and unit photos** · P0 Must

### FR09-AC01

- Type: Positive
- Trigger/input: Owner uploads valid room image
- Expected: Completed object linked to correct unit; selected image appears without per-photo reapproval.
- Evidence status: Not executed

### FR09-AC02

- Type: Validation
- Trigger/input: Wrong MIME, undecodable file or configured size/count exceeded
- Expected: Reject; no broken gallery row. Validate bytes, not extension alone.
- Evidence status: Not executed

### FR09-AC03

- Type: Security
- Trigger/input: Upload references another owner property/unit
- Expected: 403/422; no cross-property association.
- Evidence status: Not executed

### FR09-AC04

- Type: Race
- Trigger/input: Upload retry uses same operation UUID
- Expected: One media record; partial object failure never creates a public broken record.
- Evidence status: Not executed

## FR10

**Create property-level listing draft** · P0 Must

### FR10-AC01

- Type: Positive
- Trigger/input: Complete property with several units
- Expected: Draft references existing records without duplicating images or policies.
- Evidence status: Not executed

### FR10-AC02

- Type: Validation
- Trigger/input: Property is incomplete
- Expected: Draft may save; submission identifies missing details.
- Evidence status: Not executed

### FR10-AC03

- Type: Race
- Trigger/input: Two creates target same property
- Expected: Partial unique index permits one current listing.
- Evidence status: Not executed

### FR10-AC04

- Type: Security
- Trigger/input: Owner selects another property photo as cover
- Expected: Reject invalid scope.
- Evidence status: Not executed

## FR11

**Edit listing without reapproval after initial approval** · P0 Must

### FR11-AC01

- Type: Positive
- Trigger/input: Approved published listing title/photos/policies edited
- Expected: Valid changes appear; initial approval remains; audit records before/after.
- Evidence status: Not executed

### FR11-AC02

- Type: Race
- Trigger/input: Admin approves while owner edits a pending submission
- Expected: Content revision check rejects stale approval; admin reloads latest complete package.
- Evidence status: Not executed

### FR11-AC03

- Type: Race
- Trigger/input: Owner edit races with admin suspension
- Expected: Suspension wins public eligibility regardless of successful content save.
- Evidence status: Not executed

### FR11-AC04

- Type: Validation
- Trigger/input: Update removes required cover/last unit data
- Expected: Reject invalid published update or explicitly hide it; no invalid public listing.
- Evidence status: Not executed

## FR12

**Submit initial listing package** · P0 Must

### FR12-AC01

- Type: Positive
- Trigger/input: Complete draft submitted
- Expected: Initial moderation PENDING; no separate property/image approval.
- Evidence status: Not executed

### FR12-AC02

- Type: Validation
- Trigger/input: Missing required address, image, unit or policy values
- Expected: 422 with field issues; not publicly published.
- Evidence status: Not executed

### FR12-AC03

- Type: Race
- Trigger/input: Linked unit/photo changes during submit
- Expected: Property content lock/revision ensures submission refers to one consistent package.
- Evidence status: Not executed

### FR12-AC04

- Type: Integrity
- Trigger/input: Already initially approved listing updated
- Expected: Do not submit to initial moderation again; retain audit/reporting flow.
- Evidence status: Not executed

## FR13

**Review initial listing packages** · P0 Must

### FR13-AC01

- Type: Positive
- Trigger/input: Admin opens pending listing
- Expected: All linked advertised content is visible in one review screen.
- Evidence status: Not executed

### FR13-AC02

- Type: Security
- Trigger/input: Non-admin opens queue
- Expected: 403; no private review data.
- Evidence status: Not executed

### FR13-AC03

- Type: Race
- Trigger/input: Content changes after admin opens screen
- Expected: Approval compares both listing and property revisions; stale decision returns 409.
- Evidence status: Not executed

## FR14

**Approve initial listing package** · P0 Must

### FR14-AC01

- Type: Positive
- Trigger/input: Admin approves unchanged pending package
- Expected: APPROVED and approval metadata saved; owner may publish.
- Evidence status: Not executed

### FR14-AC02

- Type: Race
- Trigger/input: Property/unit/media/policy edit precedes decision commit
- Expected: Stale revision rejected; no approval of unreviewed initial content.
- Evidence status: Not executed

### FR14-AC03

- Type: Race
- Trigger/input: Two admins approve/reject concurrently
- Expected: Only first legal transition commits; second gets current result/409.
- Evidence status: Not executed

### FR14-AC04

- Type: Integrity
- Trigger/input: Approved listing edited later
- Expected: Approval retained; no perpetual equality requirement with current revision.
- Evidence status: Not executed

## FR15

**Reject initial listing with reason** · P0 Must

### FR15-AC01

- Type: Positive
- Trigger/input: Admin rejects incomplete/misleading package
- Expected: REJECTED; owner sees reason; no public publication.
- Evidence status: Not executed

### FR15-AC02

- Type: Validation
- Trigger/input: Reason empty
- Expected: 422; unchanged.
- Evidence status: Not executed

### FR15-AC03

- Type: Race
- Trigger/input: Approve and reject compete
- Expected: One decision commits with matching audit/outbox.
- Evidence status: Not executed

## FR16

**Dedicated changes requested state** · P2 Defer

### FR16-AC01

- Type: Scope
- Trigger/input: Admin requests changes in MVP
- Expected: Use FR15 and owner resubmission; no unsupported state in API/UI.
- Evidence status: Not executed

## FR17

**Publish initially approved listing** · P0 Must

### FR17-AC01

- Type: Positive
- Trigger/input: Initially approved complete listing has available unit
- Expected: Publication PUBLISHED; public search/details can return it.
- Evidence status: Not executed

### FR17-AC02

- Type: Validation
- Trigger/input: Initial moderation not approved or admin_suspended_at present
- Expected: Reject publication.
- Evidence status: Not executed

### FR17-AC03

- Type: Race
- Trigger/input: Publish races with suspension or last unit reservation
- Expected: Recheck locked current state; unavailable listing never shown as available.
- Evidence status: Not executed

### FR17-AC04

- Type: Boundary
- Trigger/input: Future tenancy leaves a nonoverlapping earlier period
- Expected: Unit may qualify only if entire requested interval fits.
- Evidence status: Not executed

## FR18

**Hide or archive listing** · P0 Must

### FR18-AC01

- Type: Positive
- Trigger/input: Owner hides listing
- Expected: Remove from public search and normal public details; preserve enquiries/contracts.
- Evidence status: Not executed

### FR18-AC02

- Type: Security
- Trigger/input: Owner attempts to clear admin suspension
- Expected: 403/422.
- Evidence status: Not executed

### FR18-AC03

- Type: Race
- Trigger/input: Publish competes with hide/archive
- Expected: Revision and shared locks produce consistent final state; stale cache does not expose hidden content.
- Evidence status: Not executed

## FR19

**Search listings by location and date-based availability** · P0 Must

### FR19-AC01

- Type: Positive
- Trigger/input: Two units, one occupied for requested interval
- Expected: Return listing with only qualifying unit count/prices.
- Evidence status: Not executed

### FR19-AC02

- Type: Boundary
- Trigger/input: A unit is held from 1 July. The visitor enters move-in 1 April, and that unit’s minimum rental months make the stay end on 1 July.
- Expected: Return the listing when the operational and marketing conditions are met. The visitor does not enter an end date, and a missing end date is not a validation error.
- Evidence status: Not executed

### FR19-AC03

- Type: Integrity
- Trigger/input: One unit meets price and another meets room filter
- Expected: Listing qualifies only if the same eligible unit meets combined filters.
- Evidence status: Not executed

### FR19-AC04

- Type: Race
- Trigger/input: Reservation commits between search and proposal
- Expected: Search is indicative; proposal rechecks database exclusion and returns conflict if needed.
- Evidence status: Not executed

### FR19-AC05

- Type: Positive
- Trigger/input: Search a stored address, ward, or city with whitespace and case variations
- Expected: Only matching public listings appear. Selected unit filters and a move-in date still apply. When a move-in date is set, a matching place with no unit free for the implied stay is excluded. With no move-in date, a held listing can remain, labeled by the units that are free today.
- Evidence status: Not executed

### FR19-AC06

- Type: Positive
- Trigger/input: Paginate/reload/clear location or enter unknown location
- Expected: URL preserves filter state; clearing location leaves other filters; unknown locations show empty results without disclosure of hidden listings.
- Evidence status: Not executed

## FR20

**Filter eligible units for the full requested interval** · P0 Must

### FR20-AC01

- Type: Positive
- Trigger/input: User filters pets allowed and rent below 5m
- Expected: Apply inherited effective pet policy and rent to same eligible unit.
- Evidence status: Not executed

### FR20-AC02

- Type: Validation
- Trigger/input: An invalid move-in date, or a valid move-in whose implied stay overlaps a blocking tenancy
- Expected: An invalid date returns a validation error. A valid move-in whose implied stay is fully blocked omits the listing. A missing end date is not an error, because search has no end date.
- Evidence status: Not executed

### FR20-AC03

- Type: Boundary
- Trigger/input: One tenancy ends June30 and next starts July1
- Expected: Adjacent intervals do not overlap.
- Evidence status: Not executed

### FR20-AC04

- Type: Race
- Trigger/input: Operational status changes during pagination
- Expected: Fresh query respects new status; no authoritative reservation inferred.
- Evidence status: Not executed

## FR21

**Display listing details and eligible unit cards** · P0 Must

### FR21-AC01

- Type: Positive
- Trigger/input: Open a published listing that still has at least one available unit, including a held unit
- Expected: Show the available unit and keep the held unit visible with its held label. Detail does not reapply the search move-in date. Do not show agreement documents or another prospect’s contact details. Saving the enquiry belongs to FR25, not this case.
- Evidence status: Not executed

### FR21-AC02

- Type: Security
- Trigger/input: Direct URL targets suspended/hidden/unapproved listing
- Expected: 404 or unavailable page with no hidden content payload.
- Evidence status: Not executed

### FR21-AC03

- Type: Integrity
- Trigger/input: Current advertised policies differ from signed contract
- Expected: Label advertising separately; no rewrite of contractual rules.
- Evidence status: Not executed

### FR21-AC04

- Type: Race
- Trigger/input: Listing suspended after cache was populated
- Expected: Public resource gate checks current visibility before returning sensitive/hidden listing data.
- Evidence status: Not executed

## FR22

**Interactive listing map** · P2 Defer

### FR22-AC01

- Type: Positive
- Trigger/input: Map enabled with valid coordinates
- Expected: Only eligible filtered properties displayed.
- Evidence status: Not executed

### FR22-AC02

- Type: Failure
- Trigger/input: Provider unavailable or coordinates missing
- Expected: List search remains usable.
- Evidence status: Not executed

## FR23

**Synchronize map and filters** · P2 Defer

### FR23-AC01

- Type: Positive
- Trigger/input: Filters change
- Expected: Map/list apply identical visibility and unit criteria.
- Evidence status: Not executed

### FR23-AC02

- Type: Race
- Trigger/input: Map requests finish out of order
- Expected: Stale result discarded.
- Evidence status: Not executed

## FR24

**Geocode address** · P2 Defer

### FR24-AC01

- Type: Positive
- Trigger/input: Geocode succeeds for current address revision
- Expected: Save valid latitude/longitude.
- Evidence status: Not executed

### FR24-AC02

- Type: Race
- Trigger/input: Old address job completes after newer edit
- Expected: Discard stale result using revision.
- Evidence status: Not executed

### FR24-AC03

- Type: Failure
- Trigger/input: Rate limit/provider failure
- Expected: Address remains saved; retry bounded and logged.
- Evidence status: Not executed

## FR25

**Submit rental request with contact details** · P0 Must

### FR25-AC01

- Type: Positive
- Trigger/input: Tenant submits valid three-month request
- Expected: PENDING request stored and owner notified with private contact snapshots.
- Evidence status: Not executed

### FR25-AC02

- Type: Validation
- Trigger/input: Missing/invalid phone or dates, own listing, or unit outside property
- Expected: Reject with field errors; phone syntax validation is not verification.
- Evidence status: Not executed

### FR25-AC03

- Type: Security
- Trigger/input: Other tenant reads contact details
- Expected: Denied; only requester, owning manager and authorized admin may access.
- Evidence status: Not executed

### FR25-AC04

- Type: Race
- Trigger/input: Same request submitted twice
- Expected: Idempotency key and one PENDING tenant/listing index yield one thread.
- Evidence status: Not executed

### FR25-AC05

- Type: Integrity
- Trigger/input: Tenant later changes profile phone
- Expected: Submitted contact snapshot remains unchanged.
- Evidence status: Not executed

## FR26

**Prevent duplicate pending rental requests** · P0 Must

### FR26-AC01

- Type: Race
- Trigger/input: Two independent connections submit same tenant/listing
- Expected: One PENDING row; loser returns existing thread or 409.
- Evidence status: Not executed

### FR26-AC02

- Type: Positive
- Trigger/input: Prior enquiry is terminal and user submits new valid one
- Expected: New PENDING request permitted.
- Evidence status: Not executed

### FR26-AC03

- Type: Integrity
- Trigger/input: Owner calls tenant or views message
- Expected: Request remains PENDING; no implied acceptance or allocation.
- Evidence status: Not executed

## FR27

**Tenant rental request dashboard** · P0 Must

### FR27-AC01

- Type: Positive
- Trigger/input: Proposal created from pending enquiry
- Expected: Show ACCEPTED plus Awaiting your contract confirmation.
- Evidence status: Not executed

### FR27-AC02

- Type: Integrity
- Trigger/input: Tenant rejects contract version later
- Expected: Request acceptance history retained; tenancy shows Awaiting revision.
- Evidence status: Not executed

### FR27-AC03

- Type: Security
- Trigger/input: Another tenant requests dashboard row
- Expected: 403/404.
- Evidence status: Not executed

### FR27-AC04

- Type: Positive
- Trigger/input: Owner discusses by phone
- Expected: Request stays PENDING until proposal created.
- Evidence status: Not executed

## FR28

**Withdraw pending rental request** · P0 Must

### FR28-AC01

- Type: Positive
- Trigger/input: Withdraw pending thread
- Expected: WITHDRAWN; no unit to release.
- Evidence status: Not executed

### FR28-AC02

- Type: Race
- Trigger/input: Withdraw competes with proposal creation
- Expected: Same request lock; either withdrawn with no tenancy or accepted with tenancy, never both.
- Evidence status: Not executed

### FR28-AC03

- Type: Validation
- Trigger/input: Withdraw accepted thread
- Expected: 409 with link to tenancy workflow.
- Evidence status: Not executed

## FR29

**Owner rental request inbox** · P0 Must

### FR29-AC01

- Type: Positive
- Trigger/input: Owner opens pending enquiry
- Expected: Phone/contact visible; no reservation created by reading/calling.
- Evidence status: Not executed

### FR29-AC02

- Type: Security
- Trigger/input: Different owner accesses inbox row
- Expected: 403/404.
- Evidence status: Not executed

### FR29-AC03

- Type: Integrity
- Trigger/input: Owner records valid proposal
- Expected: Request becomes ACCEPTED only within proposal transaction.
- Evidence status: Not executed

### FR29-AC04

- Type: Race
- Trigger/input: Inbox stale after tenant withdraws
- Expected: Create action rechecks request PENDING and fails safely.
- Evidence status: Not executed

## FR30

**Accept request when tenancy proposal commits** · P0 Must

### FR30-AC01

- Type: Positive
- Trigger/input: Owner submits valid proposal with explicit confirmation
- Expected: One PENDING_CONFIRMATION tenancy; request ACCEPTED; owner confirmation refers to exact version.
- Evidence status: Not executed

### FR30-AC02

- Type: Failure
- Trigger/input: Database overlap constraint or file validation fails
- Expected: Rollback acceptance, tenancy/version, audit/outbox and reservation.
- Evidence status: Not executed

### FR30-AC03

- Type: Race
- Trigger/input: Reject/withdraw competes with proposal
- Expected: One valid terminal request transition; no accepted request without tenancy.
- Evidence status: Not executed

### FR30-AC04

- Type: Integrity
- Trigger/input: Other requests concern same or alternative units
- Expected: Do not immediately reject them; apply 15-day availability policy.
- Evidence status: Not executed

## FR31

**Reject pending rental request** · P0 Must

### FR31-AC01

- Type: Positive
- Trigger/input: Owner rejects with reason
- Expected: REJECTED, history and tenant notice committed.
- Evidence status: Not executed

### FR31-AC02

- Type: Validation
- Trigger/input: Blank reason or terminal request
- Expected: 422/409; unchanged.
- Evidence status: Not executed

### FR31-AC03

- Type: Race
- Trigger/input: Reject races with Create tenancy proposal
- Expected: One terminal transition; no duplicate tenancy/outcome.
- Evidence status: Not executed

## FR32

**Audit request and tenancy outcomes** · P0 Must

### FR32-AC01

- Type: Positive
- Trigger/input: Request accepted through proposal
- Expected: Audit links request, tenancy and version identities.
- Evidence status: Not executed

### FR32-AC02

- Type: Integrity
- Trigger/input: Proposal later rejected/expired
- Expected: Acceptance event retained; separate tenancy outcome appended.
- Evidence status: Not executed

### FR32-AC03

- Type: Failure
- Trigger/input: Business transaction rolls back
- Expected: No success audit/outbox survives.
- Evidence status: Not executed

### FR32-AC04

- Type: Security
- Trigger/input: User tries editing/deleting audit event
- Expected: Denied by API and database privilege/trigger policy.
- Evidence status: Not executed

## FR33

**Enforce nonoverlapping unit rental periods** · P0 Must

### FR33-AC01

- Type: Race
- Trigger/input: Two transactions propose overlapping periods for same unit
- Expected: At most one commits; other gets SQLSTATE 23P01 mapped to 409.
- Evidence status: Not executed

### FR33-AC02

- Type: Positive
- Trigger/input: Same unit proposed for adjacent June30/July1 periods
- Expected: Both may commit if each otherwise eligible.
- Evidence status: Not executed

### FR33-AC03

- Type: Integrity
- Trigger/input: Direct SQL inserts overlapping blocking rows
- Expected: Exclusion constraint rejects even if API locks are bypassed.
- Evidence status: Not executed

### FR33-AC04

- Type: Race
- Trigger/input: Renewal expansion overlaps another future tenancy
- Expected: Expansion fails atomically; current confirmed agreement remains.
- Evidence status: Not executed

### FR33-AC05

- Type: Integrity
- Trigger/input: Old unique one-active-tenancy-per-unit index exists
- Expected: Remove it; date exclusion replaces lifetime allocation restriction.
- Evidence status: Not executed

## FR34

**Create tenancy proposal with temporary reservation** · P0 Must

### FR34-AC01

- Type: Positive
- Trigger/input: Owner proposes July1-December31
- Expected: PENDING_CONFIRMATION reserves only that period; enquiry ACCEPTED; tenant invited to review exact version.
- Evidence status: Not executed

### FR34-AC02

- Type: Validation
- Trigger/input: Tenant mismatch, invalid dates/rent, original period below3calendar months (including month-end/leap-year boundaries), unit unavailable or missing private file
- Expected: 422/409 and no accepted request.
- Evidence status: Not executed

### FR34-AC03

- Type: Race
- Trigger/input: Two owners tabs propose same request
- Expected: Unique rental_request_id permits one tenancy; idempotent identical replay returns it.
- Evidence status: Not executed

### FR34-AC04

- Type: Race
- Trigger/input: Unit put in maintenance while proposal submitted
- Expected: Shared property/unit locks and eligibility recheck prevent ineligible proposal.
- Evidence status: Not executed

### FR34-AC05

- Type: Integrity
- Trigger/input: Move-in date arrives before both confirmations
- Expected: No automatic activation; reservation expiry still applies.
- Evidence status: Not executed

## FR35

**View tenancy timeline and contract versions** · P0 Must

### FR35-AC01

- Type: Positive
- Trigger/input: Version1 rejected, version2 confirmed
- Expected: Both visible with distinct document/terms/decisions; current points to version2.
- Evidence status: Not executed

### FR35-AC02

- Type: Security
- Trigger/input: Unrelated user requests document URL
- Expected: 403/404; short-lived private download only after authorization.
- Evidence status: Not executed

### FR35-AC03

- Type: Integrity
- Trigger/input: Future renewal is mutually confirmed
- Expected: Show current original rent until renewal start, then renewal rent.
- Evidence status: Not executed

### FR35-AC04

- Type: Boundary
- Trigger/input: Date beyond last confirmed term
- Expected: Show no confirmed term for date; never substitute proposed rent.
- Evidence status: Not executed

## FR36

**Submit tenancy based review** · P2 Defer

### FR36-AC01

- Type: Positive
- Trigger/input: Eligible tenant submits valid review
- Expected: PENDING review linked to tenancy/property.
- Evidence status: Not executed

### FR36-AC02

- Type: Security
- Trigger/input: Non-tenant or invalid rating
- Expected: Reject.
- Evidence status: Not executed

### FR36-AC03

- Type: Race
- Trigger/input: Two submissions for same tenancy
- Expected: Unique tenancy_id permits one review.
- Evidence status: Not executed

## FR37

**Display approved property reviews** · P2 Defer

### FR37-AC01

- Type: Positive
- Trigger/input: Approved review exists
- Expected: Shown with correct aggregate; pending/rejected excluded.
- Evidence status: Not executed

### FR37-AC02

- Type: Race
- Trigger/input: Review hidden while aggregate cached
- Expected: Invalidate aggregate and details; no fabricated reviews.
- Evidence status: Not executed

## FR38

**Report public listing** · P0 Must

### FR38-AC01

- Type: Positive
- Trigger/input: Authenticated user reports visible listing
- Expected: Report, reporter and listing recorded; not auto-hidden solely from one report.
- Evidence status: Not executed

### FR38-AC02

- Type: Security
- Trigger/input: Guest submits or client forges reporter/status
- Expected: 401/restricted input rejected.
- Evidence status: Not executed

### FR38-AC03

- Type: Validation
- Trigger/input: Invalid reason/empty required explanation
- Expected: 422.
- Evidence status: Not executed

### FR38-AC04

- Type: Race
- Trigger/input: Same reporter concurrently reports same listing
- Expected: At most one OPEN/REVIEWING report; unique constraint returns existing/conflict.
- Evidence status: Not executed

### FR38-AC05

- Type: Race
- Trigger/input: Listing hidden between view and submit
- Expected: 404/unavailable; existing reports preserved; server rechecks eligibility under property lock.
- Evidence status: Not executed

## FR39

**Investigate reports and suspend listings** · P0 Must

### FR39-AC01

- Type: Positive
- Trigger/input: Admin resolves valid report and suspends listing
- Expected: Report outcome, suspension fields, audit and notice intent commit together.
- Evidence status: Not executed

### FR39-AC02

- Type: Validation
- Trigger/input: Final decision lacks reason
- Expected: 422; unchanged.
- Evidence status: Not executed

### FR39-AC03

- Type: Race
- Trigger/input: Two admins resolve/dismiss report
- Expected: One terminal outcome; second stale action gets409.
- Evidence status: Not executed

### FR39-AC04

- Type: Race
- Trigger/input: Owner publishes while admin suspends
- Expected: Shared lock retains suspension; owner cannot clear it.
- Evidence status: Not executed

## FR40

**Public listing REST resources** · P0 Must

### FR40-AC01

- Type: Positive
- Trigger/input: Valid search/detail requests
- Expected: 200 and documented JSON shape.
- Evidence status: Not executed

### FR40-AC02

- Type: Negative
- Trigger/input: Unavailable/nonexistent UUID
- Expected: 404; invalid filter422.
- Evidence status: Not executed

### FR40-AC03

- Type: Security
- Trigger/input: Public response serialized
- Expected: No private documents, tokens, admin flags or tenant contacts.
- Evidence status: Not executed

## FR41

**Property and unit REST CRUD** · P0 Must

### FR41-AC01

- Type: Positive
- Trigger/input: Owner edits own unit through API
- Expected: Validated update and audit; increment appropriate revisions.
- Evidence status: Not executed

### FR41-AC02

- Type: Security
- Trigger/input: Caller alters foreign property/unit or protected moderation fields
- Expected: 403/422.
- Evidence status: Not executed

### FR41-AC03

- Type: Race
- Trigger/input: Stale content revision submitted
- Expected: 409; no lost update.
- Evidence status: Not executed

## FR42

**Rental request tenancy and renewal action APIs** · P0 Must

### FR42-AC01

- Type: Positive
- Trigger/input: Next.js invokes proposal/confirmation APIs
- Expected: Documented statuses and UUID links returned; private resources authorized.
- Evidence status: Not executed

### FR42-AC02

- Type: Security
- Trigger/input: User forges actor_role/version owner
- Expected: Role derived from tenancy parties; 403.
- Evidence status: Not executed

### FR42-AC03

- Type: Race
- Trigger/input: Client sends stale tenancy revision or superseded version UUID
- Expected: 409 without changing confirmations or blocked span.
- Evidence status: Not executed

### FR42-AC04

- Type: Integrity
- Trigger/input: Equivalent HTTP and worker actions run
- Expected: Both use same business locks/constraints.
- Evidence status: Not executed

## FR43

**Protect APIs with Sanctum sessions and scoped tokens** · P0 Must

### FR43-AC01

- Type: Positive
- Trigger/input: Call private API using a valid browser session, then call /api/v1/me using an account:read personal token without cookies
- Expected: Both supported credential modes authenticate the same Laravel user/profile; browser login never creates a PAT; provider JWT is rejected.
- Evidence status: Not executed

### FR43-AC02

- Type: Security
- Trigger/input: Present tampered, expired, revoked or unknown personal token without a session
- Expected: 401, no protected data or mutation; token secret/hash are not returned or logged.
- Evidence status: Not executed

### FR43-AC03

- Type: Security
- Trigger/input: Forge actor/admin fields or submit wildcard/admin token abilities
- Expected: Reject escalation; actor is authenticated users/profile UUID and current Policies determine access.
- Evidence status: Not executed

### FR43-AC04

- Type: Security
- Trigger/input: Use personal token on an admin, token-management or other session-only endpoint
- Expected: 403 for unsupported credential mode even if token belongs to an admin; no data or side effect.
- Evidence status: Not executed

### FR43-AC05

- Type: Race
- Trigger/input: Token revocation or account suspension races with a protected operation
- Expected: After revocation/suspension commits, newly authenticated requests fail. Document already-authorized in-flight requests; sensitive domain actions recheck current account/Policy under their transaction rules.
- Evidence status: Not executed

### FR43-AC06

- Type: Security
- Trigger/input: Use favourites:read token to change a favourite or target another user
- Expected: 403 for missing favourites:write; possessing write ability still cannot read/write another account’s records.
- Evidence status: Not executed

### FR43-AC07

- Type: Security
- Trigger/input: Replay an expired/revoked token against the running auth:sanctum path
- Expected: 401; real bearer/DB tests inspect hashed storage, expiry and revocation. actingAs-only tests are insufficient.
- Evidence status: Not executed

### FR43-AC08

- Type: Security
- Trigger/input: Make a first-party session request that tokenCan reports allowed for
- Expected: Current resource/admin Policies still deny foreign or forbidden actions; tokenCan success is not proof of user permission.
- Evidence status: Not executed

## FR44

**OpenAPI documentation** · P1 Should

### FR44-AC01

- Type: Positive
- Trigger/input: Open Scramble docs and follow each authentication example
- Expected: Browser session/CSRF and non-browser bearer modes, token scope matrix, session-only actions and 401/403/419/422 responses match the implemented routes.
- Evidence status: Not executed

### FR44-AC02

- Type: Validation
- Trigger/input: Try documented request flow
- Expected: Matches implemented field names and state enums.
- Evidence status: Not executed

### FR44-AC03

- Type: Security
- Trigger/input: Published specification
- Expected: No secrets or live private document URLs.
- Evidence status: Not executed

## FR45

**Asynchronous domain notifications** · P1 Should

### FR45-AC01

- Type: Positive
- Trigger/input: Owner creates proposal
- Expected: Tenant notification links exact version/deadline after commit.
- Evidence status: Not executed

### FR45-AC02

- Type: Failure
- Trigger/input: Delivery service unavailable
- Expected: Business transaction remains committed; bounded worker retries and observable failure.
- Evidence status: Not executed

### FR45-AC03

- Type: Race
- Trigger/input: Worker repeats event
- Expected: Recipient inbox event uniqueness prevents duplicate inbox items.
- Evidence status: Not executed

### FR45-AC04

- Type: Integrity
- Trigger/input: Proposal replaced before delayed notice delivered
- Expected: Notice points to historical version and current UI flags superseded; no stale confirm action allowed.
- Evidence status: Not executed

## FR46

**Cache public listing content with fresh visibility checks** · P1 Should

### FR46-AC01

- Type: Positive
- Trigger/input: Owner edits approved content
- Expected: Cache invalidated; refreshed content appears without reapproval.
- Evidence status: Not executed

### FR46-AC02

- Type: Race
- Trigger/input: Admin suspends while stale cache exists
- Expected: Current visibility gate prevents serving suspended listing from normal app routes.
- Evidence status: Not executed

### FR46-AC03

- Type: Integrity
- Trigger/input: Search cache says available but reservation has committed
- Expected: Proposal fails with conflict; cache never authorizes allocation.
- Evidence status: Not executed

## FR47

**Structured logs and critical alerts** · P1 Should

### FR47-AC01

- Type: Failure
- Trigger/input: Simulate storage or exhausted notification failure
- Expected: Useful structured log with correlation ID; critical alert emitted with deduplication.
- Evidence status: Not executed

### FR47-AC02

- Type: Security
- Trigger/input: Inspect log payload
- Expected: No passwords, access/refresh tokens, full contracts or signed URLs.
- Evidence status: Not executed

### FR47-AC03

- Type: Integrity
- Trigger/input: Notification provider fails while alerting
- Expected: Log fallback; do not roll back completed business action.
- Evidence status: Not executed

## FR48

**Development monitoring and slow query alerts** · P1 Should

### FR48-AC01

- Type: Positive
- Trigger/input: Slow query exceeds configured threshold
- Expected: Record duration/query fingerprint/correlation; deliver alert once per dedupe window.
- Evidence status: Not executed

### FR48-AC02

- Type: Security
- Trigger/input: Public visitor requests Telescope
- Expected: Unavailable or403; query bindings redact sensitive information.
- Evidence status: Not executed

### FR48-AC03

- Type: Failure
- Trigger/input: Monitor/alert service down
- Expected: App continues; local diagnostic fallback.
- Evidence status: Not executed

## FR49

**Password reset and email confirmation** · P0 Must

### FR49-AC01

- Type: Positive
- Trigger/input: Use valid Laravel broker link to reset password
- Expected: Hash changes, reset link consumed, all sessions/PATs revoked and remember token rotated; fresh login required. No prior authenticated session is required to redeem the valid link.
- Evidence status: Not executed

### FR49-AC02

- Type: Security
- Trigger/input: Use expired/replayed reset token, forged verification signature or arbitrary redirect
- Expected: Reject; no password/email/account change or external redirect. Valid verification is idempotent and bound to the intended user/email.
- Evidence status: Not executed

### FR49-AC03

- Type: Privacy
- Trigger/input: Request password reset for unknown email
- Expected: Generic success response and throttling avoid account enumeration; no recovery secret in logs or analytics.
- Evidence status: Not executed

## FR50

**Create and bulk create units** · P0 Must

### FR50-AC01

- Type: Positive
- Trigger/input: Generate5 studios prefixS start201
- Expected: Preview S201–S205; individually edit S205 before save.
- Evidence status: Not executed

### FR50-AC02

- Type: Validation
- Trigger/input: Duplicate normalized labels, invalid prices/areas or batch over configured cap
- Expected: Reject entire batch with row errors; no partial rows.
- Evidence status: Not executed

### FR50-AC03

- Type: Race
- Trigger/input: Concurrent batches overlap labels
- Expected: Unique(property_id, normalized label) rejects duplicates; one batch succeeds, other rolls back.
- Evidence status: Not executed

### FR50-AC04

- Type: Integrity
- Trigger/input: WHOLE_SPACE owner invokes Add units
- Expected: Reject second unit; backend auto-unit remains sole unit.
- Evidence status: Not executed

## FR51

**Edit unit details and advertised terms** · P0 Must

### FR51-AC01

- Type: Positive
- Trigger/input: Advertised rent changes 4m to 4.5m
- Expected: Listing shows new price; existing version rent stays unchanged.
- Evidence status: Not executed

### FR51-AC02

- Type: Validation
- Trigger/input: Area/rent <=0 or minimum duration below 3 months
- Expected: 422; unchanged.
- Evidence status: Not executed

### FR51-AC03

- Type: Race
- Trigger/input: Two tabs update same unit revision
- Expected: One succeeds; stale tab receives 409.
- Evidence status: Not executed

### FR51-AC04

- Type: Integrity
- Trigger/input: Existing contracts have different policy/rent
- Expected: Never synchronize live unit values into contract versions.
- Evidence status: Not executed

## FR52

**Manage operational status independently of availability** · P0 Must

### FR52-AC01

- Type: Positive
- Trigger/input: READY unit has active tenancy for January-June
- Expected: Unavailable for overlapping dates; potentially available from July for a valid period.
- Evidence status: Not executed

### FR52-AC02

- Type: Positive
- Trigger/input: Owner marks MAINTENANCE
- Expected: Exclude from new proposals/public qualifying inventory without mutating existing contracts.
- Evidence status: Not executed

### FR52-AC03

- Type: Race
- Trigger/input: Maintenance races with new proposal
- Expected: Shared locks yield serialized eligibility decision.
- Evidence status: Not executed

### FR52-AC04

- Type: Integrity
- Trigger/input: Owner unmarkets unit
- Expected: Existing tenancy/reservation remains; operational and occupancy data unchanged.
- Evidence status: Not executed

## FR55

**Audit property unit and policy updates** · P0 Must

### FR55-AC01

- Type: Positive
- Trigger/input: Approved property policy/media changes
- Expected: Public content updates directly; initial approval retained; audit available to admin.
- Evidence status: Not executed

### FR55-AC02

- Type: Race
- Trigger/input: Initial approval and linked-content edit compete
- Expected: Common property content lock plus captured revisions prevent stale first approval.
- Evidence status: Not executed

### FR55-AC03

- Type: Security
- Trigger/input: Owner attempts audit deletion or admin flag update
- Expected: Denied.
- Evidence status: Not executed

### FR55-AC04

- Type: Integrity
- Trigger/input: Photo file changed
- Expected: Use new unique storage object; retain audit metadata/hash rather than overwriting reviewed bytes.
- Evidence status: Not executed

## FR56

**Select reorder and remove gallery images** · P0 Must

### FR56-AC01

- Type: Positive
- Trigger/input: Select newly uploaded image on approved published listing
- Expected: Appears immediately; no review state involved.
- Evidence status: Not executed

### FR56-AC02

- Type: Validation
- Trigger/input: Delete cover while keeping listing published without replacement
- Expected: 422 or explicit hide choice; never broken required cover.
- Evidence status: Not executed

### FR56-AC03

- Type: Race
- Trigger/input: Reorder/removal and caption save compete
- Expected: Media revision prevents stale resurrection; audited changes.
- Evidence status: Not executed

### FR56-AC04

- Type: Integrity
- Trigger/input: Deselect photo
- Expected: Hide from gallery; do not physically delete merely because unselected.
- Evidence status: Not executed

## FR57

**Update photos without a replacement-review workflow** · P0 Must

### FR57-AC01

- Type: Positive
- Trigger/input: Owner uploads new photo and saves gallery change
- Expected: New image immediately eligible; old image unselected/deleted as requested; audit references both UUIDs.
- Evidence status: Not executed

### FR57-AC02

- Type: Failure
- Trigger/input: Upload fails before reference swap
- Expected: Existing gallery/cover remains valid.
- Evidence status: Not executed

### FR57-AC03

- Type: Race
- Trigger/input: Two updates target same gallery/cover revision
- Expected: One wins; other reloads; no loss of a referenced object.
- Evidence status: Not executed

### FR57-AC04

- Type: Security
- Trigger/input: Owner overwrites a shared object path
- Expected: Reject path reuse; issue unique object path.
- Evidence status: Not executed

## FR59

**Delete unreferenced photo files after retention** · P1 Should

### FR59-AC01

- Type: Positive
- Trigger/input: Deleted unreferenced media reaches retention cutoff
- Expected: Delete object and set purged_at idempotently.
- Evidence status: Not executed

### FR59-AC02

- Type: Race
- Trigger/input: Cleanup races with cover selection
- Expected: Shared lock/recheck prevents deletion of newly referenced live object.
- Evidence status: Not executed

### FR59-AC03

- Type: Integrity
- Trigger/input: Photo only unselected
- Expected: Retain unless explicitly deleted/eligible orphan; no automatic purge.
- Evidence status: Not executed

### FR59-AC04

- Type: Security
- Trigger/input: Cleanup scans contracts bucket
- Expected: Do not purge immutable agreements under media policy.
- Evidence status: Not executed

## FR60

**Manage controlled property JSONB policies** · P0 Must

### FR60-AC01

- Type: Positive
- Trigger/input: Owner sets pets NOT_ALLOWED and quiet hours
- Expected: Store controlled JSONB; display defaults/shared rules.
- Evidence status: Not executed

### FR60-AC02

- Type: Validation
- Trigger/input: Unknown key, invalid enum, oversized rule or executable markup
- Expected: Reject invalid structure; safely render plain text.
- Evidence status: Not executed

### FR60-AC03

- Type: Integrity
- Trigger/input: Owner changes advertised rule after agreement
- Expected: Immutable contract policies_snapshot/document unchanged.
- Evidence status: Not executed

### FR60-AC04

- Type: Race
- Trigger/input: Policy edit races with initial listing approval
- Expected: Stale initial approval rejected; after approval no reapproval.
- Evidence status: Not executed

## FR61

**Resolve unit policy overrides and additional rules** · P0 Must

### FR61-AC01

- Type: Positive
- Trigger/input: Property pets NOT_ALLOWED, unit override ASK_OWNER
- Expected: Display ASK_OWNER plus shared rules and additional unit rules.
- Evidence status: Not executed

### FR61-AC02

- Type: Validation
- Trigger/input: Unit tries removing shared_rules or injects arbitrary policy key
- Expected: Reject; unit override schema cannot remove mandatory building rules.
- Evidence status: Not executed

### FR61-AC03

- Type: Integrity
- Trigger/input: Tenant negotiated cat permission
- Expected: Contract snapshot stores actual negotiated allowance, distinct from current advertising.
- Evidence status: Not executed

### FR61-AC04

- Type: Race
- Trigger/input: Property changes while proposal snapshots terms
- Expected: Transaction reads coherent agreed values; explicit negotiated form wins, not later live data.
- Evidence status: Not executed

## FR66

**Cancel proposals and end confirmed tenancies** · P0 Must

### FR66-AC01

- Type: Positive
- Trigger/input: Initial proposed version declined
- Expected: Record tenant decline; clear pending pointer/deadline and blocked dates; AWAITING_REVISION.
- Evidence status: Not executed

### FR66-AC02

- Type: Positive
- Trigger/input: Confirmed occupancy ends early
- Expected: Set ENDED and actual_ended_at; released future dates available if READY/marketed.
- Evidence status: Not executed

### FR66-AC03

- Type: Race
- Trigger/input: Cancel/end races with final confirmation/renewal
- Expected: One serialized legal outcome; no resurrected tenancy or orphan reservation.
- Evidence status: Not executed

### FR66-AC04

- Type: Integrity
- Trigger/input: Request was ACCEPTED before proposal cancellation
- Expected: Keep historical ACCEPTED; show linked cancelled/expired tenancy, not a fabricated completed rental.
- Evidence status: Not executed

### FR66-AC05

- Type: Boundary
- Trigger/input: Contract date ends with no physical move-out confirmation
- Expected: Do not fabricate actual_ended_at; scheduling follows agreed range. Overstay requires an explicit audited operational block/maintenance action.
- Evidence status: Not executed

## FR67

**Record original immutable agreement version** · P0 Must

### FR67-AC01

- Type: Positive
- Trigger/input: Offline signed June20, uploaded June23, starts July1
- Expected: Keep signed_on, created_at and start_date distinct.
- Evidence status: Not executed

### FR67-AC02

- Type: Validation
- Trigger/input: Signing date unknown
- Expected: Allow null; never fabricate it from created_at.
- Evidence status: Not executed

### FR67-AC03

- Type: Security
- Trigger/input: Update/delete terms or replace document bytes after version inserted
- Expected: Database privileges/triggers reject; new version and new path required.
- Evidence status: Not executed

### FR67-AC04

- Type: Race
- Trigger/input: Two inserts choose same tenancy version_number
- Expected: Unique (tenancy_id,version_number) rejects duplicate; action retries safely.
- Evidence status: Not executed

## FR68

**Submit one pending renewal request** · P0 Must

### FR68-AC01

- Type: Positive
- Trigger/input: Tenant requests continuation through December
- Expected: PENDING renewal request; original term/range unchanged.
- Evidence status: Not executed

### FR68-AC02

- Type: Race
- Trigger/input: Concurrent renewal requests
- Expected: Partial unique index permits one PENDING row.
- Evidence status: Not executed

### FR68-AC03

- Type: Validation
- Trigger/input: Wrong tenant, ended tenancy, invalid date/rent or upcoming confirmed renewal exists
- Expected: Reject with clear reason.
- Evidence status: Not executed

### FR68-AC04

- Type: Integrity
- Trigger/input: Owner discusses different final rent offline
- Expected: Keep requested value; final version stores separately negotiated amount.
- Evidence status: Not executed

## FR69

**Withdraw or reject pending renewal request** · P0 Must

### FR69-AC01

- Type: Positive
- Trigger/input: Tenant withdraws renewal with reserved extension
- Expected: CANCELLED; pending pointer cleared; only unconfirmed extension released.
- Evidence status: Not executed

### FR69-AC02

- Type: Positive
- Trigger/input: Owner rejects request
- Expected: REJECTED with reason, no change to confirmed original contract.
- Evidence status: Not executed

### FR69-AC03

- Type: Race
- Trigger/input: Withdrawal/rejection competes with final mutual confirmation
- Expected: One terminal result; accepted renewal cannot be silently cancelled as pending.
- Evidence status: Not executed

### FR69-AC04

- Type: Integrity
- Trigger/input: Old notification refers to cancelled renewal version
- Expected: Confirmation endpoint rejects stale/terminal workflow.
- Evidence status: Not executed

## FR70

**Propose renewal as new immutable version** · P0 Must

### FR70-AC01

- Type: Positive
- Trigger/input: Original Jan-June; proposed July-Dec at4.2m
- Expected: New RENEWAL version, temporary July-Dec extension reservation; current rent unchanged.
- Evidence status: Not executed

### FR70-AC02

- Type: Validation
- Trigger/input: Start is not confirmed_end+1day or end not later
- Expected: Reject; no gaps/overlaps or altered original term.
- Evidence status: Not executed

### FR70-AC03

- Type: Race
- Trigger/input: Future tenancy already reserves overlapping extension
- Expected: Exclusion constraint fails; request stays PENDING; original agreement remains.
- Evidence status: Not executed

### FR70-AC04

- Type: Race
- Trigger/input: Two owners tabs propose or correct renewal
- Expected: One pending version under tenancy lock/revision; no parallel effective renewal.
- Evidence status: Not executed

### FR70-AC05

- Type: Integrity
- Trigger/input: Tenant confirms version after owner confirmation
- Expected: Request ACCEPTED, extension confirmed; future rent activates only on renewal start.
- Evidence status: Not executed

### FR70-AC06

- Type: Failure
- Trigger/input: Mutual confirmation transaction fails
- Expected: No partial ACCEPTED renewal or confirmed extension.
- Evidence status: Not executed

## FR71

**Keep immutable versions and effective agreement history** · P0 Must

### FR71-AC01

- Type: Positive
- Trigger/input: Original v1 rejected, corrected v2 mutually confirmed, renewal v3 later confirmed
- Expected: Keep all three; v2 covers original dates; v3 covers continuation; v1 has no contractual effect.
- Evidence status: Not executed

### FR71-AC02

- Type: Integrity
- Trigger/input: Owner edits advertised terms/policies
- Expected: Existing version/document/hash/snapshot remains unchanged.
- Evidence status: Not executed

### FR71-AC03

- Type: Security
- Trigger/input: Attempt database UPDATE/DELETE on contract terms or existing confirmation metadata
- Expected: Denied by trigger/privileges, not API convention alone.
- Evidence status: Not executed

### FR71-AC04

- Type: Boundary
- Trigger/input: No confirmed segment covers queried date
- Expected: Show no confirmed terms for this date; proposed terms separately labeled.
- Evidence status: Not executed

## FR72

**Reporter outcome and rate limits** · P0 Must

### FR72-AC01

- Type: Positive
- Trigger/input: Reporter views resolved report
- Expected: Own status and safe outcome only.
- Evidence status: Not executed

### FR72-AC02

- Type: Security
- Trigger/input: Reporter guesses another report or requests internal notes
- Expected: 403/404; notes omitted.
- Evidence status: Not executed

### FR72-AC03

- Type: Abuse
- Trigger/input: Configured limit exceeded
- Expected: 429 without creating report/outbox.
- Evidence status: Not executed

### FR72-AC04

- Type: Race
- Trigger/input: Duplicate report while report is REVIEWING
- Expected: Return existing live report/conflict; no duplicate.
- Evidence status: Not executed

## FR73

**Private notification inbox** · P1 Should

### FR73-AC01

- Type: Positive
- Trigger/input: User marks own notification read twice
- Expected: Idempotent read_at; no duplicate rows.
- Evidence status: Not executed

### FR73-AC02

- Type: Security
- Trigger/input: Other user reads/marks it
- Expected: 403/404.
- Evidence status: Not executed

### FR73-AC03

- Type: Race
- Trigger/input: Same event delivered twice
- Expected: Unique recipient/event_key yields one notification.
- Evidence status: Not executed

## FR74

**Idempotent writes and stale revisions** · P0 Must

### FR74-AC01

- Type: Race
- Trigger/input: Network retry after successful commit
- Expected: Existing resource/result returned without duplicate audit or notification intent.
- Evidence status: Not executed

### FR74-AC02

- Type: Security
- Trigger/input: Other actor uses guessed operation UUID
- Expected: No cross-actor result disclosure.
- Evidence status: Not executed

### FR74-AC03

- Type: Race
- Trigger/input: Two updates with same expected revision
- Expected: Only one succeeds; losing write409.
- Evidence status: Not executed

### FR74-AC04

- Type: Integrity
- Trigger/input: Concurrency acceptance tests run
- Expected: Use independent PostgreSQL connections/barrier, not only sequential mocks.
- Evidence status: Not executed

## FR75

**Transactional locking audit and consistency** · P0 Must

### FR75-AC01

- Type: Race
- Trigger/input: Two proposal/renewal/expiry actions use independent connections
- Expected: Consistent locks avoid lost changes; deadlocks retried boundedly.
- Evidence status: Not executed

### FR75-AC02

- Type: Failure
- Trigger/input: Action fails after adding version before reservation acceptance
- Expected: Whole action rolls back; only staged orphan file may remain.
- Evidence status: Not executed

### FR75-AC03

- Type: Integrity
- Trigger/input: Direct SQL attempts invalid pending pointer or confirmation actor
- Expected: Composite FK/check/constraint trigger rejects invalid committed state.
- Evidence status: Not executed

### FR75-AC04

- Type: Security
- Trigger/input: Frontend anon key attempts app table writes
- Expected: Denied by grants/RLS; Laravel verified actions enforce domain rules.
- Evidence status: Not executed

## FR76

**Deferred and excluded MVP scope** · P3 Exclude

### FR76-AC01

- Type: Integrity
- Trigger/input: Review MVP screens/API/schema
- Expected: No mandatory phone verification or removed review/scheduling workflow.
- Evidence status: Not executed

### FR76-AC02

- Type: Integrity
- Trigger/input: Contract confirmation shown
- Expected: Describe participant acknowledgement of stored version; do not claim verified legal e-signature.
- Evidence status: Not executed

### FR76-AC03

- Type: Positive
- Trigger/input: Later extension added
- Expected: Use explicit requirements/migration rather than reviving removed states implicitly.
- Evidence status: Not executed

## FR77

**Calculate availability counts and rent ranges** · P0 Must

### FR77-AC01

- Type: Positive
- Trigger/input: One of two units reserved for requested period
- Expected: Available count2→1 and range from remaining unit.
- Evidence status: Not executed

### FR77-AC02

- Type: Boundary
- Trigger/input: Two tenancies on same unit occupy distinct future intervals
- Expected: Only intersecting searches exclude it; do not treat any tenancy row as permanent occupation.
- Evidence status: Not executed

### FR77-AC03

- Type: Race
- Trigger/input: Reservation expires concurrently with inventory read
- Expected: Committed query gives coherent before/after; proposal action rechecks/reaps due holds under lock.
- Evidence status: Not executed

### FR77-AC04

- Type: Integrity
- Trigger/input: Last unit unavailable
- Expected: Hide from available search for that interval; do not change stored publication_status or auto-republish owner-hidden content.
- Evidence status: Not executed

## FR78

**Suspend and restore listings after reports or inspection** · P0 Must

### FR78-AC01

- Type: Positive
- Trigger/input: Admin sees harmful new image
- Expected: Suspend whole listing immediately; no media review-status machinery.
- Evidence status: Not executed

### FR78-AC02

- Type: Race
- Trigger/input: Owner edits/republishes while admin suspends
- Expected: Admin flag remains; all normal public listing routes deny exposure.
- Evidence status: Not executed

### FR78-AC03

- Type: Security
- Trigger/input: Owner clears suspension field
- Expected: Reject by field allowlist/policy.
- Evidence status: Not executed

### FR78-AC04

- Type: Positive
- Trigger/input: Admin restores after investigation
- Expected: Clear suspension with audit; public visibility still requires owner PUBLISHED and all eligibility gates.
- Evidence status: Not executed

### FR78-AC05

- Type: Integrity
- Trigger/input: Previously public photo URL was downloaded
- Expected: Normal public listing hidden; remove offending object if needed. Do not claim ability to recall downloaded copies.
- Evidence status: Not executed

## FR79

**Moderate optional property reviews** · P2 Defer

### FR79-AC01

- Type: Positive
- Trigger/input: Approve PENDING review
- Expected: Visible and included in aggregate.
- Evidence status: Not executed

### FR79-AC02

- Type: Race
- Trigger/input: Review edited during moderation
- Expected: Expected revision prevents stale approval.
- Evidence status: Not executed

### FR79-AC03

- Type: Security
- Trigger/input: Normal user moderates review
- Expected: 403.
- Evidence status: Not executed

## FR80

**Confirm move-in after mutual contract confirmation** · P0 Must

### FR80-AC01

- Type: Positive
- Trigger/input: Both parties confirmed v2, start date reached
- Expected: Owner marks ACTIVE, same UUID/confirmed span; no duplicate acceptance.
- Evidence status: Not executed

### FR80-AC02

- Type: Validation
- Trigger/input: Version unconfirmed, before start, or tenancy cancelled
- Expected: 409/422; no activation.
- Evidence status: Not executed

### FR80-AC03

- Type: Race
- Trigger/input: Move-in races with cancel/end
- Expected: One legal transition commits.
- Evidence status: Not executed

### FR80-AC04

- Type: Integrity
- Trigger/input: Date arrives without move-in action
- Expected: Show awaiting move-in; do not invent actual occupancy.
- Evidence status: Not executed

## FR81

**Confirm the exact contract version mutually** · P0 Must

### FR81-AC01

- Type: Positive
- Trigger/input: Owner confirmed v2; tenant confirms v2/hash
- Expected: Both confirmation timestamps; initial tenancy CONFIRMED; confirmed dates set; no pending deadline.
- Evidence status: Not executed

### FR81-AC02

- Type: Validation
- Trigger/input: Owner confirmed v1 but tenant confirms v2
- Expected: No agreement until both independently confirm v2; never mix version decisions.
- Evidence status: Not executed

### FR81-AC03

- Type: Race
- Trigger/input: Tenant confirms v1 while owner publishes corrected v2
- Expected: Same tenancy lock yields one winner; superseded confirmation rejected 409 or correction disallowed after agreement.
- Evidence status: Not executed

### FR81-AC04

- Type: Race
- Trigger/input: Final confirm competes with deadline worker
- Expected: Compare server now under lock; at/after deadline no confirmation. Worker cannot undo already confirmed agreement.
- Evidence status: Not executed

### FR81-AC05

- Type: Race
- Trigger/input: Double-click confirmation
- Expected: Write-once confirmation fields gives one write-once decision; same replay returns result.
- Evidence status: Not executed

### FR81-AC06

- Type: Integrity
- Trigger/input: Renewal final confirmation succeeds
- Expected: Renewal request ACCEPTED and confirmed end extended in same transaction; old documents remain.
- Evidence status: Not executed

## FR82

**Decline and correct unconfirmed versions** · P0 Must

### FR82-AC01

- Type: Positive
- Trigger/input: Tenant spots wrong rent in v1 and declines
- Expected: Record REJECTED decision/reason; immutable v1 retained; release proposed span only.
- Evidence status: Not executed

### FR82-AC02

- Type: Positive
- Trigger/input: Owner corrects rent as v2
- Expected: New UUID/hash/version_number; new owner confirmation; tenant must confirm v2.
- Evidence status: Not executed

### FR82-AC03

- Type: Race
- Trigger/input: Correction tries reacquiring dates now reserved elsewhere
- Expected: 409; no new active hold or false acceptance.
- Evidence status: Not executed

### FR82-AC04

- Type: Validation
- Trigger/input: Owner attempts correction after mutual confirmation
- Expected: Reject; amendments to confirmed terms are deferred.
- Evidence status: Not executed

### FR82-AC05

- Type: Race
- Trigger/input: Tenant confirms while owner corrects
- Expected: Same pending pointer/revision lock; no mismatched version or retroactive change.
- Evidence status: Not executed

## FR83

**Expire temporary confirmation reservations** · P0 Must

### FR83-AC01

- Type: Boundary
- Trigger/input: Server time reaches deadline exactly
- Expected: Confirmation disallowed; due hold released transactionally.
- Evidence status: Not executed

### FR83-AC02

- Type: Race
- Trigger/input: Two workers expire same hold
- Expected: One state change/audit/outbox event; retries no-op.
- Evidence status: Not executed

### FR83-AC03

- Type: Race
- Trigger/input: Expiry competes with final confirmation or correction
- Expected: Lock/recheck exact pending version/deadline; stale worker cannot expire newer hold.
- Evidence status: Not executed

### FR83-AC04

- Type: Failure
- Trigger/input: Scheduler delayed
- Expected: Hold remains conservatively blocked until reaped; proposal path can reap due conflicts under locks before retry.
- Evidence status: Not executed

### FR83-AC05

- Type: Integrity
- Trigger/input: Renewal expires
- Expected: Original confirmed range/rent unchanged; release extension only.
- Evidence status: Not executed

## FR84

**Reserve renewal extension without releasing current occupancy** · P0 Must

### FR84-AC01

- Type: Positive
- Trigger/input: Confirmed ends June30; pending renewal ends Dec31
- Expected: Block Jan1-Dec31 envelope while original confirmed ends June30.
- Evidence status: Not executed

### FR84-AC02

- Type: Race
- Trigger/input: Another tenant requests July1-Dec31 while renewal pending
- Expected: Exclusion denies overlapping second tenancy.
- Evidence status: Not executed

### FR84-AC03

- Type: Integrity
- Trigger/input: Renewal rejected/expired
- Expected: Restore Jan1-June30 only; keep original agreement and status.
- Evidence status: Not executed

### FR84-AC04

- Type: Race
- Trigger/input: Two future adjacent bookings and renewal compete
- Expected: Database exclusion decides valid committed schedule; no renewal overrides existing booking.
- Evidence status: Not executed

## FR85

**Apply 15-day rejection using actual availability** · P0 Must

### FR85-AC01

- Type: Boundary
- Trigger/input: Request age14d23h59m and all units blocked
- Expected: Keep PENDING; not due.
- Evidence status: Not executed

### FR85-AC02

- Type: Positive
- Trigger/input: Age>=15d and no qualifying unit for complete requested period
- Expected: REJECTED with system reason and availability evaluation timestamp; audit/notify once.
- Evidence status: Not executed

### FR85-AC03

- Type: Positive
- Trigger/input: Age>=15d and alternative unit available although preferred unit blocked
- Expected: Keep PENDING.
- Evidence status: Not executed

### FR85-AC04

- Type: Positive
- Trigger/input: Age>=15d and reservation just expired
- Expected: Reap expired hold under lock; retain request if unit now available.
- Evidence status: Not executed

### FR85-AC05

- Type: Race
- Trigger/input: Scheduler rejects while owner creates proposal or tenant withdraws
- Expected: Shared property/unit/request locks; one terminal transition; no rejected accepted request.
- Evidence status: Not executed

### FR85-AC06

- Type: Race
- Trigger/input: New unit or maintenance release competes with availability scan
- Expected: Property lock across inventory-changing actions produces a coherent decision.
- Evidence status: Not executed

### FR85-AC07

- Type: Integrity
- Trigger/input: Listing manually hidden but suitable unit available
- Expected: Do not infer no availability from publication state; keep request pending.
- Evidence status: Not executed

### FR85-AC08

- Type: Boundary
- Trigger/input: Desired move-in already in past
- Expected: Do not silently shift dates; use stored interval, flag for discussion. Stale-date expiry is deferred.
- Evidence status: Not executed

## FR86

**Enforce immutable contract terms and write-once confirmations** · P0 Must

### FR86-AC01

- Type: Integrity
- Trigger/input: Direct SQL changes version rent/document or overwrites a recorded confirmation
- Expected: Database trigger denies write.
- Evidence status: Not executed

### FR86-AC02

- Type: Integrity
- Trigger/input: Direct insert points tenancy to another tenancy version
- Expected: Composite FK rejects.
- Evidence status: Not executed

### FR86-AC03

- Type: Integrity
- Trigger/input: Direct insert confirmation by unrelated profile or conflicting confirmation/rejection
- Expected: Party-validation/write-once trigger rejects.
- Evidence status: Not executed

### FR86-AC04

- Type: Integrity
- Trigger/input: Transaction commits ACCEPTED request without tenancy or confirmed span without matching mutual versions
- Expected: Deferred constraint trigger rejects inconsistent committed state.
- Evidence status: Not executed

### FR86-AC05

- Type: Race
- Trigger/input: Two transactions mutate pointers/confirmations
- Expected: Unique constraints, row locks and commit-time invariant checks preserve one current workflow.
- Evidence status: Not executed

## FR87

**Manage consistent standard and custom amenities** · P0 Must

### FR87-AC01

- Type: Positive
- Trigger/input: Owner selects Wi-Fi and Elevator in property form and AC in unit form
- Expected: Save canonical wifi/elevator/air_conditioning keys in correct JSONB scope; labels come from code catalog.
- Evidence status: Not executed

### FR87-AC02

- Type: Validation
- Trigger/input: Payload has unknown standard key, owner_label, wrong scope/type, oversized text or malformed root
- Expected: Laravel rejects with field errors; no partial change. Validate configured limits, schema_version, enabled boolean and optional details.
- Evidence status: Not executed

### FR87-AC03

- Type: Positive
- Trigger/input: Owner enters composed/decomposed Vietnamese text with extra whitespace
- Expected: NFC-normalize, trim and collapse whitespace; retain Vietnamese accents/display spelling. Deduplicate same-resource custom text via case-folded comparison only.
- Evidence status: Not executed

### FR87-AC04

- Type: Integrity
- Trigger/input: Owner enters EV Charger but catalog has no matching standard option
- Expected: Save as custom text after explicit Add additional feature action; do not generate a global slug or automatically match an EV-charging filter.
- Evidence status: Not executed

### FR87-AC05

- Type: Positive
- Trigger/input: Owner searches AC or aircon through explicitly maintained aliases
- Expected: Suggest catalog air_conditioning; selection stores canonical key. Do not infer synonyms by slugification or automatically select without owner choice.
- Evidence status: Not executed

### FR87-AC06

- Type: Integrity
- Trigger/input: Shared laundry exists but no washing machine inside requested unit
- Expected: Show shared feature separately; in-unit washing-machine filter does not match the shared facility. Apply all unit filters to same available unit.
- Evidence status: Not executed

### FR87-AC07

- Type: Integrity
- Trigger/input: Catalog display label changes or standard enabled=false/absent
- Expected: Existing stable keys need no row migration; enabled=false/absent does not qualify for filter; absent means not advertised, not verified absent.
- Evidence status: Not executed

### FR87-AC08

- Type: Race
- Trigger/input: Two tabs edit amenity JSONB from same property/unit revision
- Expected: Only one expected-revision update commits; other409. No silent JSON document replacement losing selected/custom entries; audit consistent.
- Evidence status: Not executed

### FR87-AC09

- Type: Race
- Trigger/input: Initial listing admin approval races with amenity edit
- Expected: Common property content lock/revision rejects stale first approval. Later approved-listing edits need no reapproval; suspension still respected.
- Evidence status: Not executed

### FR87-AC10

- Type: Integrity
- Trigger/input: Migrate old amenity arrays into new JSONB structure
- Expected: Preserve recognized canonical codes under standard; map legacy labels only via reviewed explicit aliases, keep unknown descriptions under custom and audit migration. Do not conflate shared/private scope or blindly slugify labels.
- Evidence status: Not executed

## FR88

**Save and manage favourite properties** · P0 Must

### FR88-AC01

- Type: Positive
- Trigger/input: Authenticated user saves and reloads a property
- Expected: One persistent user/property save; heart state remains after reload.
- Evidence status: Not executed

### FR88-AC02

- Type: Authorization
- Trigger/input: Guest tries to save a property
- Expected: Require sign-in; no anonymous persisted or queued save.
- Evidence status: Not executed

### FR88-AC03

- Type: Integrity
- Trigger/input: Same property appears through different units/listings
- Expected: One user/property identity, not one favourite per listing/unit.
- Evidence status: Not executed

### FR88-AC04

- Type: Race
- Trigger/input: Concurrent repeated save requests
- Expected: Unique user/property pair; first intended-state PUT returns 201, repeat returns 200.
- Evidence status: Not executed

### FR88-AC05

- Type: Race
- Trigger/input: Save/remove requests or responses arrive out of order
- Expected: Serialize intended state per property and reconcile with server; stale response cannot overwrite latest intent.
- Evidence status: Not executed

### FR88-AC06

- Type: Privacy
- Trigger/input: User switches accounts or requests another user’s list
- Expected: Private list/count only; clear previous account data and deny foreign access.
- Evidence status: Not executed

### FR88-AC07

- Type: Visibility
- Trigger/input: Saved property becomes hidden/suspended/archived
- Expected: Generic removable placeholder with no title/photo/address/moderation reason.
- Evidence status: Not executed

### FR88-AC08

- Type: Positive
- Trigger/input: Repeated removal, including an unavailable property
- Expected: Idempotent DELETE 204; the user can remove their stored relation.
- Evidence status: Not executed

### FR88-AC09

- Type: Failure
- Trigger/input: Save/remove request fails over network
- Expected: Restore/refetch server state and show retry feedback.
- Evidence status: Not executed

### FR88-AC10

- Type: Boundary
- Trigger/input: Saved property has no date-qualified available unit
- Expected: Save remains; no rental request, contact disclosure or unit reservation is created.
- Evidence status: Not executed

## FR89

**Manage personal API tokens** · P0 Must

### FR89-AC01

- Type: Positive
- Trigger/input: Verified user confirms password and creates a named token with account:read and 7-day expiry
- Expected: 201 returns plaintext once over HTTPS/no-store; DB stores SHA-256 hash, UUID user reference, exact allowed abilities and finite expires_at.
- Evidence status: Not executed

### FR89-AC02

- Type: Privacy
- Trigger/input: Reload token list or inspect subsequent API responses, audit logs and Telescope
- Expected: Only metadata/status is shown; plaintext token, hash, cookies and password never appear. No secret is persisted in TanStack/localStorage or generic idempotency response cache.
- Evidence status: Not executed

### FR89-AC03

- Type: Validation
- Trigger/input: Submit missing/oversized name, empty/unknown/wildcard/admin abilities, or expiry outside 1/7/30-day choices
- Expected: 422 and no token. Default 30 days is documented as a configurable project default; client may only choose the approved options.
- Evidence status: Not executed

### FR89-AC04

- Type: Security
- Trigger/input: Attempt creation/revocation without browser session, with stale password confirmation or invalid CSRF
- Expected: Session-only guard/confirmation/CSRF rejects before mutation; API token alone cannot list, create or revoke tokens.
- Evidence status: Not executed

### FR89-AC05

- Type: Security
- Trigger/input: User B guesses user A token id in list/revoke
- Expected: Current-user-scoped query returns 404; no metadata leakage or foreign revocation.
- Evidence status: Not executed

### FR89-AC06

- Type: Positive
- Trigger/input: Revoke own token and replay it without session cookies
- Expected: 204; subsequent request returns 401. Rotation requires explicitly creating replacement and revoking old; expired token remains unusable before scheduled pruning.
- Evidence status: Not executed

### FR89-AC07

- Type: Failure
- Trigger/input: Token creation response is lost after commit
- Expected: Do not automatically retry or recover secret from storage; show metadata on refresh, allow revoke and explicit new creation. No plaintext replay record exists.
- Evidence status: Not executed

### FR89-AC08

- Type: Security
- Trigger/input: Reset password or suspend account with live sessions and tokens
- Expected: Revoke all PATs and sessions as part of the security action; active-account middleware blocks suspended users immediately on new requests. Re-enabling an account does not restore revoked tokens.
- Evidence status: Not executed

## FR90

**Protect browser forms against CSRF** · P0 Must

### FR90-AC01

- Type: Positive
- Trigger/input: Browser gets /sanctum/csrf-cookie then submits an allowed form with credentials and matching X-XSRF-TOKEN
- Expected: Expected success and server-side validation; session cookie is HttpOnly, readable XSRF cookie is used only for CSRF and is not a login credential.
- Evidence status: Not executed

### FR90-AC02

- Type: Security
- Trigger/input: Submit login and representative authenticated POST/PUT/PATCH/DELETE requests with missing/wrong/other-session CSRF
- Expected: 419 on Laravel baseline; no database/audit/outbox/storage side effects. Test CSRF middleware with the framework test bypass explicitly disabled.
- Evidence status: Not executed

### FR90-AC03

- Type: Security
- Trigger/input: Cross-site form sends victim session cookies without correct CSRF
- Expected: No state change; no blanket CSRF exemption on api/* or authentication endpoints. CORS does not substitute for CSRF validation.
- Evidence status: Not executed

### FR90-AC04

- Type: Positive
- Trigger/input: Cookie-free non-browser request uses a valid favourites:write token on the approved route
- Expected: Succeeds subject to scope/Policy without CSRF cookie. A disallowed browser origin or mixed stale session request cannot turn into a CSRF bypass.
- Evidence status: Not executed

### FR90-AC05

- Type: Failure
- Trigger/input: Session/CSRF expires while filling a form
- Expected: Show 401/419 recovery feedback, preserve safe input, reinitialize/login as needed and ask for explicit resubmission; do not blindly repeat contract or other writes.
- Evidence status: Not executed

### FR90-AC06

- Type: Deployment
- Trigger/input: Test localhost ports and production sibling subdomains with exact credentialed CORS settings
- Expected: Cookies, XSRF header, allowed origins and stateful host:port list agree; HTTPS Secure cookie works. Unrelated default domains fail the deployment checklist until a documented same-origin proxy/domain arrangement is implemented.
- Evidence status: Not executed
