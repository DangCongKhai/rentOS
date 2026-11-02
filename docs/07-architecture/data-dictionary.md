# Database dictionary

One `users` row is the account. Domain foreign keys point at `users.id`. Supabase is PostgreSQL and Storage only.

## users

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Laravel Authenticatable user UUID. Domain rows reference this id. |
| name | text |  | No |  | Display name from registration or account settings. |
| email | text | UNIQUE | No |  | Normalized lowercase login email. |
| email_verified_at | timestamptz |  | Yes |  | Set only by valid Laravel email verification. |
| password | varchar(255) |  | No |  | Laravel Hash password hash; hidden from every Resource/log. |
| remember_token | varchar(100) |  | Yes |  | Laravel remember credential; remember-me disabled initially; rotate on password reset. |
| phone | text |  | Yes |  | Optional contact number; not OTP ownership verification. |
| is_admin | boolean |  | No | false | Trusted server-managed moderation privilege. |
| account_status | text |  | No | ACTIVE | ACTIVE or SUSPENDED. |
| created_at | timestamptz |  | No | now() | Account creation time. |
| updated_at | timestamptz |  | No | now() | Account update time. |

## properties

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Application UUID |
| owner_id | uuid | FK | No |  | Authorized manager profile; MVP one owner |
| client_operation_id | uuid |  | No |  | Idempotent create key scoped to owner |
| name | text |  | No |  | Property name |
| property_type | text |  | No |  | HOUSE APARTMENT APARTMENT_BUILDING |
| rental_arrangement | text |  | No |  | WHOLE_SPACE or SEPARATE_UNITS |
| address_line | text |  | Yes |  | Street and building address; may be null in incomplete draft, required at listing submission/publication |
| ward | text |  | Yes |  | Optional local ward |
| city | text |  | Yes |  | City; may be null in incomplete draft, required at listing submission/publication |
| description | text |  | Yes |  | Shared property description; may be null in incomplete draft, required at listing submission/publication |
| shared_amenities | jsonb |  | No | {"schema_version":1,"standard":{},"custom":[]} | Shared property facilities. Controlled JSONB {schema_version:1,standard:{catalog_key:{enabled:boolean,details?:text}},custom:[text]}. Standard keys/scopes from Laravel catalog; canonical labels from catalog, no owner_label. Custom text NFC/trim/whitespace-normalized and deduplicated locally using case folding; never auto-promoted to standard search keys. Absent key means not advertised. |
| policies | jsonb |  | No |  | schema_version defaults pets/smoking and shared_rules |
| content_revision | integer |  | No | 1 | Increment on property/unit/media/policy content writes; initial listing stale-review guard |
| latitude | numeric |  | Yes |  | Optional geocoding latitude -90 to90 |
| longitude | numeric |  | Yes |  | Optional longitude -180 to180 |
| archived_at | timestamptz |  | Yes |  | Archive instead of destructive delete |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |

## units

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Stable unit UUID |
| property_id | uuid | FK | No |  | Parent property |
| client_operation_id | uuid |  | No |  | Per-preview-row idempotency UUID; unique with property_id, including bulk rows |
| label | text |  | No |  | Room S201 or Entire property; normalized label unique per property |
| unit_kind | text |  | No |  | ROOM STUDIO APARTMENT HOUSE |
| description | text |  | Yes |  | Unit specific description; may be null in incomplete draft, required at listing submission/publication |
| floor | text |  | Yes |  | Flexible floor label |
| area_m2 | numeric |  | Yes |  | Positive floor area; may be null in incomplete draft, required at listing submission/publication |
| bedrooms | integer |  | No |  | Nonnegative; room/studio may use0 |
| bathrooms | numeric |  | No |  | Nonnegative count |
| bathroom_arrangement | text |  | No |  | PRIVATE or SHARED |
| amenities | jsonb |  | No | {"schema_version":1,"standard":{},"custom":[]} | Features inside the individual unit. Controlled JSONB {schema_version:1,standard:{catalog_key:{enabled:boolean,details?:text}},custom:[text]}. Standard keys/scopes from Laravel catalog; canonical labels from catalog, no owner_label. Custom text NFC/trim/whitespace-normalized and deduplicated locally using case folding; never auto-promoted to standard search keys. Absent key means not advertised. |
| advertised_monthly_rent | numeric |  | Yes |  | Positive NUMERIC(14,0) VND; not agreed contract rent; may be null in incomplete draft, required at listing submission/publication |
| deposit | numeric |  | Yes |  | Nonnegative NUMERIC(14,0) VND; may be null in incomplete draft, required at listing submission/publication |
| minimum_rental_months | integer |  | No |  | At least3 |
| max_occupants | integer |  | Yes |  | Positive occupancy limit; may be null in incomplete draft, required at listing submission/publication |
| operational_status | text |  | No | READY | READY MAINTENANCE RETIRED |
| is_marketed | boolean |  | No | false | Explicit owner advertising choice; enable only with complete required unit data |
| policy_overrides | jsonb |  | No | {} | Allowed enum overrides and additional_rules |
| archived_at | timestamptz |  | Yes |  | Preserve historical references |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |

## property_media

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Photo UUID; no review or replacement-chain state |
| property_id | uuid | FK | No |  | Parent property |
| unit_id | uuid | FK | Yes |  | Optional unit in same property |
| uploaded_by | uuid | FK | No |  | Authorized uploader |
| client_operation_id | uuid |  | No |  | Uploader scoped submission key |
| storage_path | text | UK | No |  | Unique object path; no overwriting referenced bytes |
| caption | text |  | Yes |  | Owner caption; plain text, audited |
| sort_order | integer |  | No | 0 | Gallery order |
| is_selected_for_listing | boolean |  | No | true | Display intent independent of approval |
| purged_at | timestamptz |  | Yes |  | Storage file deletion confirmed |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |
| deleted_at | timestamptz |  | Yes |  | Soft removal; hidden from gallery; retention starts |
| sha256 | text |  | No |  | Hash of completed image bytes for audit integrity |
| mime_type | text |  | No |  | Validated decoded image media type |
| size_bytes | bigint |  | No |  | Positive completed file byte count |

## listings

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Listing UUID |
| property_id | uuid | FK | No |  | One nonarchived listing per property |
| client_operation_id | uuid |  | No |  | Property scoped create identity |
| title | text |  | No |  | Public title |
| description | text |  | No |  | Advertisement copy |
| cover_media_id | uuid | FK | Yes |  | Selected nondeleted same-property shared media; required to publish |
| moderation_status | text |  | No | DRAFT | DRAFT PENDING APPROVED REJECTED |
| publication_status | text |  | No | DRAFT | DRAFT PUBLISHED HIDDEN |
| submitted_revision | integer |  | Yes |  | Listing revision awaiting review |
| submitted_at | timestamptz |  | Yes |  | Review request time |
| reviewed_by | uuid | FK | Yes |  | Admin reviewer |
| reviewed_at | timestamptz |  | Yes |  | Decision time |
| review_reason | text |  | Yes |  | Required rejection or suspension reason |
| archived_at | timestamptz |  | Yes |  | Historical listing |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |
| submitted_content_revision | integer |  | Yes |  | Property content_revision captured at initial submission |
| approved_content_revision | integer |  | Yes |  | Historical revision initially approved; later edits need not equal it |
| admin_suspended_at | timestamptz |  | Yes |  | Admin restriction independent of initial approval and owner publication |
| admin_suspended_by | uuid | FK | Yes |  | Suspending admin profile |
| suspension_reason | text |  | Yes |  | Required while admin-suspended |

## rental_requests

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Enquiry UUID |
| listing_id | uuid | FK | No |  | Source listing |
| tenant_id | uuid | FK | No |  | Authenticated prospect |
| preferred_unit_id | uuid | FK | Yes |  | Optional preference in listing property |
| client_operation_id | uuid |  | No |  | Tenant scoped create identity |
| desired_move_in_date | date |  | No |  | Preference not contractual start |
| message | text |  | No |  | Enquiry text |
| status | text |  | No | PENDING | PENDING ACCEPTED REJECTED WITHDRAWN; ACCEPTED means tenancy proposal committed |
| outcome_reason | text |  | Yes |  | Required rejection/automatic closure explanation |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |
| contact_name | text |  | No |  | Private submitted contact snapshot |
| contact_phone | text |  | No |  | Private normalized phone snapshot; no OTP verification |
| desired_end_date | date |  | No |  | Inclusive end of requested period; required to assess actual availability |
| availability_checked_at | timestamptz |  | Yes |  | Last due15-day evaluation timestamp |
| closed_at | timestamptz |  | Yes |  | Terminal request transition time |

## tenancies

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Tenancy UUID |
| unit_id | uuid | FK | No |  | Exact allocated unit |
| tenant_id | uuid | FK | No |  | Primary tenant matches original enquiry |
| rental_request_id | uuid | FK,UK | No |  | One result per accepted enquiry |
| client_operation_id | uuid |  | No |  | Owner scoped record action identity |
| status | text |  | No | PENDING_CONFIRMATION | PENDING_CONFIRMATION AWAITING_REVISION CONFIRMED ACTIVE EXPIRED CANCELLED ENDED |
| actual_ended_at | timestamptz |  | Yes |  | Actual move-out/end or cancellation action |
| end_reason | text |  | Yes |  | Required when ending/cancelling |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |
| owner_id | uuid | FK | No |  | Manager party snapshot for contract confirmation |
| confirmed_start_date | date |  | Yes |  | Projection: first mutually confirmed segment start |
| confirmed_end_date | date |  | Yes |  | Projection: last mutually confirmed consecutive segment end |
| blocked_start_date | date |  | Yes |  | Blocking envelope start, includes proposed original/confirmed span |
| blocked_end_date | date |  | Yes |  | Blocking envelope end, includes pending renewal extension |
| pending_contract_id | uuid | FK | Yes |  | Current unconfirmed version in same tenancy; composite FK |
| latest_confirmed_contract_id | uuid | FK | Yes |  | Latest mutually confirmed segment version in same tenancy |
| confirmation_expires_at | timestamptz |  | Yes |  | Server deadline for current pending version only |
| moved_in_at | timestamptz |  | Yes |  | Owner-reported actual move-in event time |

## tenancy_renewal_requests

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Renewal request UUID |
| tenancy_id | uuid | FK | No |  | Existing CONFIRMED or ACTIVE continuing tenancy |
| client_operation_id | uuid |  | No |  | Tenancy scoped submission identity |
| requested_end_date | date |  | No |  | Proposed later end date |
| proposed_monthly_rent | numeric |  | No |  | Positive NUMERIC(14,0) VND |
| message | text |  | Yes |  | Tenant explanation |
| status | text |  | No | PENDING | PENDING ACCEPTED REJECTED CANCELLED |
| reviewed_by | uuid | FK | Yes |  | Owner for rejection; acceptance derives from final mutual confirmation |
| reviewed_at | timestamptz |  | Yes |  | Outcome time |
| review_reason | text |  | Yes |  | Required for rejection |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |

## tenancy_contracts

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Immutable version UUID |
| tenancy_id | uuid | FK | No |  | Parent continuous tenancy |
| version_number | integer |  | No |  | Monotonic per tenancy; unique with tenancy_id |
| type | text |  | No |  | ORIGINAL or RENEWAL; corrections preserve type |
| renewal_request_id | uuid | FK | Yes |  | For RENEWAL segment and corrections; many versions may share request |
| supersedes_contract_id | uuid | FK | Yes |  | Previous unconfirmed version in same tenancy/segment; no confirmed amendment MVP |
| basis_contract_id | uuid | FK | Yes |  | Confirmed preceding segment for renewal; null for original |
| start_date | date |  | No |  | Inclusive segment start; renewal starts prior confirmed end+1 |
| end_date | date |  | No |  | Inclusive segment end |
| monthly_rent | numeric |  | No |  | NUMERIC(14,0) positive VND applicable to this segment |
| deposit_amount | numeric |  | No |  | NUMERIC(14,0) nonnegative agreed deposit; do not double-charge on renewal |
| policies_snapshot | jsonb |  | No |  | Required actually negotiated resolved policies snapshot |
| document_path | text | UK | No |  | Private unique immutable object path; protect bytes from overwrite/delete |
| document_sha256 | text |  | No |  | SHA256 of exact stored document bytes |
| signed_on | date |  | Yes |  | Optional owner-reported offline signing date, not platform verified |
| created_by | uuid | FK | No |  | Owner creating and explicitly acknowledging proposal |
| created_at | timestamptz |  | No | now() | Version inserted time in UTC |
| owner_confirmed_at | timestamptz |  | No |  | Explicit owner acknowledgement of this exact contract UUID and document hash; set at proposal submission; never rewritten |
| tenant_confirmed_at | timestamptz |  | Yes |  | Tenant acknowledgement of this exact contract UUID/hash; write once from null; excludes rejection |
| tenant_rejected_at | timestamptz |  | Yes |  | Tenant decline of this exact contract; write once from null; excludes confirmation |
| tenant_rejection_reason | text |  | Yes |  | Required when tenant declines; written with tenant_rejected_at and never rewritten |

## listing_reports

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Report UUID |
| listing_id | uuid | FK | No |  | Reported advertisement |
| reporter_id | uuid | FK | No |  | Authenticated reporter |
| client_operation_id | uuid |  | No |  | Reporter scoped submission key |
| reason_code | text |  | No |  | FRAUD MISLEADING HARMFUL OTHER |
| description | text |  | No |  | Reporter explanation |
| status | text |  | No | OPEN | OPEN REVIEWING RESOLVED DISMISSED |
| resolution_summary | text |  | Yes |  | Sanitized reporter-visible outcome |
| internal_notes | text |  | Yes |  | Admin only investigation details |
| reviewed_by | uuid | FK | Yes |  | Admin deciding |
| reviewed_at | timestamptz |  | Yes |  | Decision time |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |

## audit_logs

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Audit UUID |
| actor_id | uuid | FK | Yes |  | Null for explicit system action |
| entity_type | text |  | No |  | Allowlisted table/resource kind |
| entity_id | uuid |  | No |  | Polymorphic UUID validated by backend; not a SQL FK |
| action | text |  | No |  | Transition/action name |
| before_values | jsonb |  | Yes |  | Minimal safe prior values |
| after_values | jsonb |  | Yes |  | Minimal safe resulting values |
| reason | text |  | Yes |  | Decision or operation reason |
| correlation_id | uuid |  | No |  | Request or operation correlation UUID |
| created_at | timestamptz |  | No | now() | Audit time in business transaction |

## notification_outbox

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Outbox UUID |
| event_key | text | UK | No |  | Stable unique domain event identity |
| recipient_id | uuid | FK | No |  | Recipient profile |
| event_type | text |  | No |  | Configured notification kind |
| payload | jsonb |  | No |  | Safe resource references; no tokens/documents |
| status | text |  | No | PENDING | PENDING PROCESSING DELIVERED FAILED |
| attempts | integer |  | No | 0 | Bounded retry count |
| next_attempt_at | timestamptz |  | Yes |  | Retry due time |
| locked_until | timestamptz |  | Yes |  | Worker claim lease; recover abandoned claims |
| delivered_at | timestamptz |  | Yes |  | Delivery handling completed |
| last_error | text |  | Yes |  | Redacted failure summary |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |

## notifications

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Inbox UUID |
| recipient_id | uuid | FK | No |  | Only this user can read/mark read |
| event_key | text |  | No |  | Unique with recipient_id |
| title | text |  | No |  | Safe summary |
| body | text |  | No |  | Safe message |
| resource_type | text |  | No |  | Authorized application link kind |
| resource_id | uuid |  | No |  | Target resource UUID; backend checks access |
| read_at | timestamptz |  | Yes |  | First read time |
| created_at | timestamptz |  | No | now() | Inbox creation time |

## property_reviews

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Review UUID |
| tenancy_id | uuid | FK,UK | No |  | One review per tenancy; property/tenant derived |
| rating | integer |  | No |  | 1 to5 |
| comment | text |  | No |  | Escaped plain text |
| review_status | text |  | No | PENDING | PENDING APPROVED REJECTED |
| reviewed_by | uuid | FK | Yes |  | Admin reviewer |
| reviewed_at | timestamptz |  | Yes |  | Decision time |
| review_reason | text |  | Yes |  | Required on rejection/removal |
| created_at | timestamptz |  | No | now() | Record creation time in UTC |
| updated_at | timestamptz |  | No | now() | Last record update time in UTC |

## idempotency_records

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | No | gen_random_uuid() | Operation record UUID |
| actor_id | uuid | FK | No |  | Verified caller; replay must reauthorize current access |
| action | text |  | No |  | Allowlisted action name; unique with actor and operation UUID |
| client_operation_id | uuid |  | No |  | Client generated stable write retry UUID |
| request_hash | text |  | No |  | Server SHA256 of canonical original payload including parent UUID |
| result_resource_type | text |  | No |  | Result entity kind or bulk unit result |
| result_ids | uuid[] |  | No |  | One or more resulting UUIDs; no signed links or secret response bodies |
| response_status | integer |  | No |  | Original successful HTTP status |
| created_at | timestamptz |  | No | now() | Commit time; retention must respect supported retry window |

## personal_access_tokens

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | bigint | PK | No | identity | Sanctum token ID; users/profile reference remains UUID. |
| tokenable_type | varchar(255) |  | No |  | Fixed allowed App\Models\User morph type/alias; use HasApiTokens on users. |
| tokenable_id | uuid | Morph FK | No |  | UUID of users.id; uuidMorphs-compatible; fixed user model and explicit integrity enforcement. |
| name | varchar(255) |  | No |  | Validated user-assigned token label, max 100 characters. |
| token | char(64) | UNIQUE | No |  | SHA-256 token hash; plaintext returned only at issuance, never stored/logged. |
| abilities | text |  | No |  | JSON-serialized allowed subset of account:read, favourites:read, favourites:write; no wildcard/admin permissions. |
| last_used_at | timestamptz |  | Yes |  | Updated by Sanctum when used. |
| expires_at | timestamptz |  | No |  | Required expiry chosen from 1/7/30 days; default 30 days (configurable project default). |
| created_at | timestamptz |  | No | now() | Framework creation time. |
| updated_at | timestamptz |  | No | now() | Framework update time. |

## favourite_properties

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| user_id | uuid | PK,FK | No |  | References users.id. |
| property_id | uuid | PK,FK | No |  | References properties.id; composite PK/UNIQUE(user_id,property_id). |
| created_at | timestamptz |  | No | now() | First save time; repeat intended-state save does not duplicate row. |

## sessions

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| id | varchar(255) | PK | No |  | Laravel session ID; rotate on login. |
| user_id | uuid | FK/index | Yes |  | Nullable for guest CSRF sessions; references users.id. |
| ip_address | varchar(45) |  | Yes |  | Session metadata; restrict retention/access. |
| user_agent | text |  | Yes |  | Session metadata; never treated as identity. |
| payload | text |  | No |  | Framework session payload; confidential, not exposed or logged. |
| last_activity | integer | INDEX | No |  | Unix timestamp; session lifetime/pruning. |

## password_reset_tokens

| Column | Type | Key | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| email | text | PK | No |  | Normalized user email used by Laravel password broker. |
| token | varchar(255) |  | No |  | Hashed one-time password-reset token; never serialize/log. |
| created_at | timestamptz |  | Yes |  | Password broker token expiry/throttle timestamp. |
