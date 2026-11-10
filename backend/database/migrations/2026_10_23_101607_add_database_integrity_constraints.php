<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');

        DB::unprepared(<<<'SQL'
            ALTER TABLE users
                ADD CONSTRAINT users_name_not_blank CHECK (btrim(name) <> ''),
                ADD CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email))),
                ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('ACTIVE', 'SUSPENDED'));

            ALTER TABLE properties
                ADD CONSTRAINT properties_name_not_blank CHECK (btrim(name) <> ''),
                ADD CONSTRAINT properties_type_check CHECK (property_type IN ('HOUSE', 'APARTMENT', 'APARTMENT_BUILDING')),
                ADD CONSTRAINT properties_rental_arrangement_check CHECK (rental_arrangement IN ('WHOLE_SPACE', 'SEPARATE_UNITS')),
                ADD CONSTRAINT properties_content_revision_check CHECK (content_revision >= 1),
                ADD CONSTRAINT properties_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT properties_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
                ADD CONSTRAINT properties_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
                ADD CONSTRAINT properties_shared_amenities_check CHECK (
                    jsonb_typeof(shared_amenities) = 'object'
                    AND shared_amenities->'schema_version' = '1'::jsonb
                    AND jsonb_typeof(shared_amenities->'standard') = 'object'
                    AND jsonb_typeof(shared_amenities->'custom') = 'array'
                ),
                ADD CONSTRAINT properties_policies_check CHECK (
                    jsonb_typeof(policies) = 'object'
                    AND policies->'schema_version' = '1'::jsonb
                    AND policies ? 'pets'
                    AND policies ? 'smoking'
                    AND jsonb_typeof(policies->'shared_rules') = 'array'
                );

            ALTER TABLE units
                ADD CONSTRAINT units_label_not_blank CHECK (btrim(label) <> ''),
                ADD CONSTRAINT units_kind_check CHECK (unit_kind IN ('ROOM', 'STUDIO', 'APARTMENT', 'HOUSE')),
                ADD CONSTRAINT units_area_check CHECK (area_m2 IS NULL OR area_m2 > 0),
                ADD CONSTRAINT units_bedrooms_check CHECK (bedrooms >= 0),
                ADD CONSTRAINT units_bathrooms_check CHECK (bathrooms >= 0),
                ADD CONSTRAINT units_bathroom_arrangement_check CHECK (bathroom_arrangement IN ('PRIVATE', 'SHARED')),
                ADD CONSTRAINT units_advertised_rent_check CHECK (advertised_monthly_rent IS NULL OR advertised_monthly_rent > 0),
                ADD CONSTRAINT units_deposit_check CHECK (deposit IS NULL OR deposit >= 0),
                ADD CONSTRAINT units_minimum_rental_months_check CHECK (minimum_rental_months >= 3),
                ADD CONSTRAINT units_max_occupants_check CHECK (max_occupants IS NULL OR max_occupants > 0),
                ADD CONSTRAINT units_operational_status_check CHECK (operational_status IN ('READY', 'MAINTENANCE', 'RETIRED')),
                ADD CONSTRAINT units_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT units_amenities_check CHECK (
                    jsonb_typeof(amenities) = 'object'
                    AND amenities->'schema_version' = '1'::jsonb
                    AND jsonb_typeof(amenities->'standard') = 'object'
                    AND jsonb_typeof(amenities->'custom') = 'array'
                ),
                ADD CONSTRAINT units_policy_overrides_check CHECK (jsonb_typeof(policy_overrides) = 'object'),
                ADD CONSTRAINT units_marketed_completeness_check CHECK (
                    NOT is_marketed OR (
                        description IS NOT NULL
                        AND area_m2 IS NOT NULL
                        AND advertised_monthly_rent IS NOT NULL
                        AND deposit IS NOT NULL
                        AND max_occupants IS NOT NULL
                    )
                );

            CREATE UNIQUE INDEX units_property_normalized_label_unique
                ON units (property_id, lower(btrim(label)));

            ALTER TABLE property_media
                ADD CONSTRAINT property_media_sort_order_check CHECK (sort_order >= 0),
                ADD CONSTRAINT property_media_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT property_media_size_check CHECK (size_bytes > 0),
                ADD CONSTRAINT property_media_sha256_check CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
                ADD CONSTRAINT property_media_purge_check CHECK (purged_at IS NULL OR deleted_at IS NOT NULL);

            ALTER TABLE listings
                ADD CONSTRAINT listings_title_not_blank CHECK (btrim(title) <> ''),
                ADD CONSTRAINT listings_description_not_blank CHECK (btrim(description) <> ''),
                ADD CONSTRAINT listings_moderation_status_check CHECK (moderation_status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')),
                ADD CONSTRAINT listings_publication_status_check CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'HIDDEN')),
                ADD CONSTRAINT listings_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT listings_submitted_revision_check CHECK (submitted_revision IS NULL OR submitted_revision >= 1),
                ADD CONSTRAINT listings_content_revision_checks CHECK (
                    (submitted_content_revision IS NULL OR submitted_content_revision >= 1)
                    AND (approved_content_revision IS NULL OR approved_content_revision >= 1)
                ),
                ADD CONSTRAINT listings_submission_metadata_check CHECK (
                    (submitted_at IS NULL AND submitted_revision IS NULL AND submitted_content_revision IS NULL)
                    OR (submitted_at IS NOT NULL AND submitted_revision IS NOT NULL AND submitted_content_revision IS NOT NULL)
                ),
                ADD CONSTRAINT listings_review_metadata_check CHECK (
                    (reviewed_at IS NULL AND reviewed_by IS NULL)
                    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
                ),
                ADD CONSTRAINT listings_rejection_reason_check CHECK (
                    moderation_status <> 'REJECTED' OR (review_reason IS NOT NULL AND btrim(review_reason) <> '')
                ),
                ADD CONSTRAINT listings_suspension_metadata_check CHECK (
                    (admin_suspended_at IS NULL AND admin_suspended_by IS NULL AND suspension_reason IS NULL)
                    OR (
                        admin_suspended_at IS NOT NULL
                        AND admin_suspended_by IS NOT NULL
                        AND suspension_reason IS NOT NULL
                        AND btrim(suspension_reason) <> ''
                    )
                );

            CREATE UNIQUE INDEX listings_one_current_per_property_unique
                ON listings (property_id) WHERE archived_at IS NULL;

            ALTER TABLE rental_requests
                ADD CONSTRAINT rental_requests_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
                ADD CONSTRAINT rental_requests_dates_check CHECK (
                    isfinite(desired_move_in_date)
                    AND isfinite(desired_end_date)
                    AND desired_end_date >= desired_move_in_date
                ),
                ADD CONSTRAINT rental_requests_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT rental_requests_message_not_blank CHECK (btrim(message) <> ''),
                ADD CONSTRAINT rental_requests_contact_name_not_blank CHECK (btrim(contact_name) <> ''),
                ADD CONSTRAINT rental_requests_contact_phone_not_blank CHECK (btrim(contact_phone) <> ''),
                ADD CONSTRAINT rental_requests_rejection_reason_check CHECK (
                    status <> 'REJECTED' OR (outcome_reason IS NOT NULL AND btrim(outcome_reason) <> '')
                ),
                ADD CONSTRAINT rental_requests_closed_at_check CHECK (
                    (status = 'PENDING' AND closed_at IS NULL)
                    OR (status <> 'PENDING' AND closed_at IS NOT NULL)
                );

            CREATE UNIQUE INDEX rental_requests_one_pending_per_tenant_listing_unique
                ON rental_requests (tenant_id, listing_id) WHERE status = 'PENDING';

            ALTER TABLE tenancies
                ADD CONSTRAINT tenancies_status_check CHECK (
                    status IN ('PENDING_CONFIRMATION', 'AWAITING_REVISION', 'CONFIRMED', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'ENDED')
                ),
                ADD CONSTRAINT tenancies_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT tenancies_confirmed_dates_check CHECK (
                    (confirmed_start_date IS NULL AND confirmed_end_date IS NULL)
                    OR (
                        confirmed_start_date IS NOT NULL
                        AND confirmed_end_date IS NOT NULL
                        AND isfinite(confirmed_start_date)
                        AND isfinite(confirmed_end_date)
                        AND confirmed_end_date >= confirmed_start_date
                    )
                ),
                ADD CONSTRAINT tenancies_blocked_dates_check CHECK (
                    (blocked_start_date IS NULL AND blocked_end_date IS NULL)
                    OR (
                        blocked_start_date IS NOT NULL
                        AND blocked_end_date IS NOT NULL
                        AND isfinite(blocked_start_date)
                        AND isfinite(blocked_end_date)
                        AND blocked_end_date >= blocked_start_date
                    )
                ),
                ADD CONSTRAINT tenancies_blocking_status_dates_check CHECK (
                    status NOT IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE')
                    OR (blocked_start_date IS NOT NULL AND blocked_end_date IS NOT NULL)
                ),
                ADD CONSTRAINT tenancies_end_metadata_check CHECK (
                    status NOT IN ('CANCELLED', 'ENDED')
                    OR (
                        actual_ended_at IS NOT NULL
                        AND end_reason IS NOT NULL
                        AND btrim(end_reason) <> ''
                    )
                ),
                ADD CONSTRAINT tenancies_move_in_check CHECK (status <> 'ACTIVE' OR moved_in_at IS NOT NULL);

            ALTER TABLE tenancies
                ADD CONSTRAINT tenancies_no_overlapping_blocked_ranges
                EXCLUDE USING gist (
                    unit_id WITH =,
                    daterange(blocked_start_date, blocked_end_date + 1, '[)') WITH &&
                )
                WHERE (status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE'))
                DEFERRABLE INITIALLY IMMEDIATE;

            ALTER TABLE tenancy_renewal_requests
                ADD CONSTRAINT tenancy_renewal_requests_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
                ADD CONSTRAINT tenancy_renewal_requests_rent_check CHECK (proposed_monthly_rent > 0),
                ADD CONSTRAINT tenancy_renewal_requests_date_check CHECK (isfinite(requested_end_date)),
                ADD CONSTRAINT tenancy_renewal_requests_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT tenancy_renewal_requests_review_metadata_check CHECK (
                    (reviewed_at IS NULL AND reviewed_by IS NULL)
                    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
                ),
                ADD CONSTRAINT tenancy_renewal_requests_rejection_reason_check CHECK (
                    status <> 'REJECTED' OR (review_reason IS NOT NULL AND btrim(review_reason) <> '')
                );

            CREATE UNIQUE INDEX tenancy_renewal_requests_one_pending_unique
                ON tenancy_renewal_requests (tenancy_id) WHERE status = 'PENDING';

            ALTER TABLE tenancy_contracts
                ADD CONSTRAINT tenancy_contracts_version_check CHECK (version_number >= 1),
                ADD CONSTRAINT tenancy_contracts_type_check CHECK (type IN ('ORIGINAL', 'RENEWAL')),
                ADD CONSTRAINT tenancy_contracts_dates_check CHECK (
                    isfinite(start_date) AND isfinite(end_date) AND end_date >= start_date
                ),
                ADD CONSTRAINT tenancy_contracts_rent_check CHECK (monthly_rent > 0),
                ADD CONSTRAINT tenancy_contracts_deposit_check CHECK (deposit_amount >= 0),
                ADD CONSTRAINT tenancy_contracts_policies_check CHECK (jsonb_typeof(policies_snapshot) = 'object'),
                ADD CONSTRAINT tenancy_contracts_document_sha256_check CHECK (document_sha256 ~ '^[0-9a-fA-F]{64}$'),
                ADD CONSTRAINT tenancy_contracts_outcome_check CHECK (
                    NOT (tenant_confirmed_at IS NOT NULL AND tenant_rejected_at IS NOT NULL)
                    AND (
                        (tenant_rejected_at IS NULL AND tenant_rejection_reason IS NULL)
                        OR (
                            tenant_rejected_at IS NOT NULL
                            AND tenant_rejection_reason IS NOT NULL
                            AND btrim(tenant_rejection_reason) <> ''
                        )
                    )
                ),
                ADD CONSTRAINT tenancy_contracts_type_links_check CHECK (
                    (type = 'ORIGINAL' AND renewal_request_id IS NULL AND basis_contract_id IS NULL)
                    OR (type = 'RENEWAL' AND renewal_request_id IS NOT NULL AND basis_contract_id IS NOT NULL)
                ),
                ADD CONSTRAINT tenancy_contracts_no_self_reference_check CHECK (
                    supersedes_contract_id IS DISTINCT FROM id
                    AND basis_contract_id IS DISTINCT FROM id
                );

            CREATE UNIQUE INDEX tenancy_contracts_one_confirmed_renewal_fulfillment_unique
                ON tenancy_contracts (renewal_request_id)
                WHERE renewal_request_id IS NOT NULL AND tenant_confirmed_at IS NOT NULL;

            CREATE UNIQUE INDEX tenancy_contracts_one_successor_per_version_unique
                ON tenancy_contracts (supersedes_contract_id)
                WHERE supersedes_contract_id IS NOT NULL;

            ALTER TABLE listing_reports
                ADD CONSTRAINT listing_reports_reason_code_check CHECK (reason_code IN ('FRAUD', 'MISLEADING', 'HARMFUL', 'OTHER')),
                ADD CONSTRAINT listing_reports_status_check CHECK (status IN ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED')),
                ADD CONSTRAINT listing_reports_description_not_blank CHECK (btrim(description) <> ''),
                ADD CONSTRAINT listing_reports_revision_check CHECK (revision >= 1),
                ADD CONSTRAINT listing_reports_review_metadata_check CHECK (
                    (reviewed_at IS NULL AND reviewed_by IS NULL)
                    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
                ),
                ADD CONSTRAINT listing_reports_resolution_check CHECK (
                    status NOT IN ('RESOLVED', 'DISMISSED')
                    OR (
                        reviewed_at IS NOT NULL
                        AND reviewed_by IS NOT NULL
                        AND resolution_summary IS NOT NULL
                        AND btrim(resolution_summary) <> ''
                    )
                );

            CREATE UNIQUE INDEX listing_reports_one_open_per_reporter_listing_unique
                ON listing_reports (reporter_id, listing_id) WHERE status IN ('OPEN', 'REVIEWING');

            ALTER TABLE notifications
                ADD CONSTRAINT notifications_audience_check CHECK (audience IN ('ADMIN', 'TENANT', 'OWNER'));

            ALTER TABLE idempotency_records
                ADD CONSTRAINT idempotency_records_hash_check CHECK (request_hash ~ '^[0-9a-fA-F]{64}$'),
                ADD CONSTRAINT idempotency_records_result_ids_check CHECK (cardinality(result_ids) > 0),
                ADD CONSTRAINT idempotency_records_response_status_check CHECK (response_status BETWEEN 200 AND 299);

            ALTER TABLE personal_access_tokens
                ADD CONSTRAINT personal_access_tokens_type_check CHECK (tokenable_type = 'App\Models\User'),
                ADD CONSTRAINT personal_access_tokens_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
                ADD CONSTRAINT personal_access_tokens_token_check CHECK (token ~ '^[0-9a-f]{64}$'),
                ADD CONSTRAINT personal_access_tokens_abilities_check CHECK (
                    jsonb_typeof(abilities::jsonb) = 'array'
                    AND abilities::jsonb <@ '["account:read","favourites:read","favourites:write"]'::jsonb
                ),
                ADD CONSTRAINT personal_access_tokens_expiry_check CHECK (expires_at > created_at);
            SQL);

        DB::unprepared(<<<'SQL'
            ALTER TABLE tenancies
                ADD CONSTRAINT tenancies_pending_contract_same_parent_fk
                    FOREIGN KEY (id, pending_contract_id)
                    REFERENCES tenancy_contracts (tenancy_id, id)
                    DEFERRABLE INITIALLY DEFERRED,
                ADD CONSTRAINT tenancies_latest_contract_same_parent_fk
                    FOREIGN KEY (id, latest_confirmed_contract_id)
                    REFERENCES tenancy_contracts (tenancy_id, id)
                    DEFERRABLE INITIALLY DEFERRED;

            ALTER TABLE tenancy_contracts
                ADD CONSTRAINT tenancy_contracts_renewal_same_parent_fk
                    FOREIGN KEY (tenancy_id, renewal_request_id)
                    REFERENCES tenancy_renewal_requests (tenancy_id, id)
                    DEFERRABLE INITIALLY DEFERRED,
                ADD CONSTRAINT tenancy_contracts_supersedes_same_parent_fk
                    FOREIGN KEY (tenancy_id, supersedes_contract_id)
                    REFERENCES tenancy_contracts (tenancy_id, id)
                    DEFERRABLE INITIALLY DEFERRED,
                ADD CONSTRAINT tenancy_contracts_basis_same_parent_fk
                    FOREIGN KEY (tenancy_id, basis_contract_id)
                    REFERENCES tenancy_contracts (tenancy_id, id)
                    DEFERRABLE INITIALLY DEFERRED;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.guard_tenancy_contract()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                expected_owner uuid;
                expected_tenant uuid;
                configured_actor text;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'tenancy contracts cannot be deleted';
                END IF;

                IF TG_OP = 'INSERT' THEN
                    SELECT owner_id INTO expected_owner
                    FROM tenancies
                    WHERE id = NEW.tenancy_id;

                    IF expected_owner IS NULL OR NEW.created_by IS DISTINCT FROM expected_owner THEN
                        RAISE EXCEPTION 'contract creator must be the tenancy owner';
                    END IF;

                    IF NEW.tenant_confirmed_at IS NOT NULL
                        OR NEW.tenant_rejected_at IS NOT NULL
                        OR NEW.tenant_rejection_reason IS NOT NULL THEN
                        RAISE EXCEPTION 'tenant outcome must be recorded after contract creation';
                    END IF;

                    RETURN NEW;
                END IF;

                IF (to_jsonb(NEW) - ARRAY['tenant_confirmed_at', 'tenant_rejected_at', 'tenant_rejection_reason'])
                    IS DISTINCT FROM
                    (to_jsonb(OLD) - ARRAY['tenant_confirmed_at', 'tenant_rejected_at', 'tenant_rejection_reason']) THEN
                    RAISE EXCEPTION 'tenancy contract core fields are immutable';
                END IF;

                IF OLD.tenant_confirmed_at IS NOT NULL
                    AND NEW.tenant_confirmed_at IS DISTINCT FROM OLD.tenant_confirmed_at THEN
                    RAISE EXCEPTION 'tenant confirmation is write-once';
                END IF;

                IF OLD.tenant_rejected_at IS NOT NULL
                    AND NEW.tenant_rejected_at IS DISTINCT FROM OLD.tenant_rejected_at THEN
                    RAISE EXCEPTION 'tenant rejection is write-once';
                END IF;

                IF OLD.tenant_rejection_reason IS NOT NULL
                    AND NEW.tenant_rejection_reason IS DISTINCT FROM OLD.tenant_rejection_reason THEN
                    RAISE EXCEPTION 'tenant rejection reason is write-once';
                END IF;

                IF OLD.tenant_confirmed_at IS NULL AND NEW.tenant_confirmed_at IS NOT NULL THEN
                    IF NEW.tenant_rejected_at IS NOT NULL OR NEW.tenant_rejection_reason IS NOT NULL THEN
                        RAISE EXCEPTION 'tenant confirmation and rejection are mutually exclusive';
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM tenancies
                        WHERE id = NEW.tenancy_id
                          AND pending_contract_id = NEW.id
                          AND confirmation_expires_at > CURRENT_TIMESTAMP
                    ) THEN
                        RAISE EXCEPTION 'only the current unexpired pending contract can be confirmed';
                    END IF;

                    SELECT tenant_id INTO expected_tenant
                    FROM tenancies
                    WHERE id = NEW.tenancy_id;
                    configured_actor := current_setting('rentos.actor_id', true);

                    IF configured_actor IS NULL
                        OR configured_actor = ''
                        OR configured_actor IS DISTINCT FROM expected_tenant::text THEN
                        RAISE EXCEPTION 'transaction-local actor must match the tenancy tenant';
                    END IF;
                ELSIF OLD.tenant_rejected_at IS NULL AND NEW.tenant_rejected_at IS NOT NULL THEN
                    IF NEW.tenant_confirmed_at IS NOT NULL
                        OR NEW.tenant_rejection_reason IS NULL
                        OR btrim(NEW.tenant_rejection_reason) = '' THEN
                        RAISE EXCEPTION 'tenant rejection requires one reason and excludes confirmation';
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM tenancies
                        WHERE id = NEW.tenancy_id
                          AND pending_contract_id = NEW.id
                          AND confirmation_expires_at > CURRENT_TIMESTAMP
                    ) THEN
                        RAISE EXCEPTION 'only the current unexpired pending contract can be rejected';
                    END IF;

                    SELECT tenant_id INTO expected_tenant
                    FROM tenancies
                    WHERE id = NEW.tenancy_id;
                    configured_actor := current_setting('rentos.actor_id', true);

                    IF configured_actor IS NULL
                        OR configured_actor = ''
                        OR configured_actor IS DISTINCT FROM expected_tenant::text THEN
                        RAISE EXCEPTION 'transaction-local actor must match the tenancy tenant';
                    END IF;
                ELSIF NEW IS DISTINCT FROM OLD THEN
                    RAISE EXCEPTION 'only one tenant outcome may be recorded';
                END IF;

                RETURN NEW;
            END;
            $$;

            CREATE TRIGGER tenancy_contracts_guard_insert_update
                BEFORE INSERT OR UPDATE ON tenancy_contracts
                FOR EACH ROW EXECUTE FUNCTION public.guard_tenancy_contract();

            CREATE TRIGGER tenancy_contracts_guard_delete
                BEFORE DELETE ON tenancy_contracts
                FOR EACH ROW EXECUTE FUNCTION public.guard_tenancy_contract();
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.guard_listing_lifecycle()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                current_property_revision integer;
            BEGIN
                IF NEW.publication_status = 'PUBLISHED'
                    AND OLD.publication_status <> 'PUBLISHED'
                    AND OLD.moderation_status <> 'APPROVED' THEN
                    RAISE EXCEPTION 'publishing requires a prior approved state';
                END IF;

                IF NEW.moderation_status = 'APPROVED'
                    AND OLD.moderation_status <> 'APPROVED' THEN
                    IF OLD.moderation_status <> 'PENDING' THEN
                        RAISE EXCEPTION 'approval requires a prior pending state';
                    END IF;

                    SELECT content_revision
                    INTO current_property_revision
                    FROM properties
                    WHERE id = NEW.property_id;

                    IF NEW.submitted_revision <> NEW.revision
                        OR NEW.submitted_content_revision <> current_property_revision THEN
                        RAISE EXCEPTION 'approval must use the current submitted listing and property snapshot';
                    END IF;
                END IF;

                IF OLD.moderation_status = 'APPROVED' THEN
                    IF NEW.moderation_status <> 'APPROVED' THEN
                        RAISE EXCEPTION 'initial listing approval cannot be reset';
                    END IF;

                    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
                        OR NEW.submitted_revision IS DISTINCT FROM OLD.submitted_revision
                        OR NEW.submitted_content_revision IS DISTINCT FROM OLD.submitted_content_revision
                        OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
                        OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
                        OR NEW.approved_content_revision IS DISTINCT FROM OLD.approved_content_revision THEN
                        RAISE EXCEPTION 'approved listing snapshot metadata is immutable';
                    END IF;
                END IF;

                RETURN NEW;
            END;
            $$;

            CREATE TRIGGER listings_lifecycle_guard
                BEFORE UPDATE ON listings
                FOR EACH ROW EXECUTE FUNCTION public.guard_listing_lifecycle();

            CREATE OR REPLACE FUNCTION public.validate_listing_cover(listing_uuid uuid)
            RETURNS void
            LANGUAGE plpgsql
            AS $$
            DECLARE
                target listings%ROWTYPE;
                current_property_revision integer;
            BEGIN
                SELECT * INTO target FROM listings WHERE id = listing_uuid;
                IF NOT FOUND THEN
                    RETURN;
                END IF;

                SELECT content_revision
                INTO current_property_revision
                FROM properties
                WHERE id = target.property_id;

                IF target.moderation_status = 'PENDING' THEN
                    IF target.submitted_at IS NULL
                        OR target.submitted_revision IS NULL
                        OR target.submitted_content_revision IS NULL THEN
                        RAISE EXCEPTION 'pending listing requires submitted snapshot metadata';
                    END IF;

                    IF target.submitted_revision <> target.revision
                        OR target.submitted_content_revision <> current_property_revision THEN
                        RAISE EXCEPTION 'pending listing submitted snapshot must match current listing and property revisions';
                    END IF;
                END IF;

                IF target.moderation_status = 'APPROVED'
                    OR target.publication_status = 'PUBLISHED' THEN
                    IF target.submitted_at IS NULL
                        OR target.submitted_revision IS NULL
                        OR target.submitted_content_revision IS NULL THEN
                        RAISE EXCEPTION 'approved or published listing requires submitted snapshot metadata';
                    END IF;

                    IF target.reviewed_by IS NULL
                        OR target.reviewed_at IS NULL
                        OR target.approved_content_revision IS NULL THEN
                        RAISE EXCEPTION 'approved listing requires reviewer and approval metadata';
                    END IF;

                    IF target.approved_content_revision <> target.submitted_content_revision THEN
                        RAISE EXCEPTION 'approved content revision must equal submitted content revision';
                    END IF;
                END IF;

                IF (
                    target.publication_status = 'PUBLISHED'
                    OR target.moderation_status = 'PENDING'
                ) AND target.cover_media_id IS NULL THEN
                    RAISE EXCEPTION 'submitted or published listing requires a cover';
                END IF;

                IF target.cover_media_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM property_media media
                    WHERE media.id = target.cover_media_id
                      AND media.property_id = target.property_id
                      AND media.unit_id IS NULL
                      AND media.is_selected_for_listing
                      AND media.deleted_at IS NULL
                      AND media.purged_at IS NULL
                ) THEN
                    RAISE EXCEPTION 'listing cover must be selected, live, shared same-property media';
                END IF;

                IF target.publication_status = 'PUBLISHED' THEN
                    IF target.moderation_status <> 'APPROVED'
                        OR target.archived_at IS NOT NULL
                        OR target.approved_content_revision IS NULL THEN
                        RAISE EXCEPTION 'published listing must be approved and current';
                    END IF;
                END IF;

                IF target.publication_status = 'PUBLISHED'
                    OR target.moderation_status = 'PENDING' THEN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM properties property
                        WHERE property.id = target.property_id
                          AND property.archived_at IS NULL
                          AND property.address_line IS NOT NULL
                          AND btrim(property.address_line) <> ''
                          AND property.district IS NOT NULL
                          AND btrim(property.district) <> ''
                          AND property.city IS NOT NULL
                          AND btrim(property.city) <> ''
                          AND property.description IS NOT NULL
                          AND btrim(property.description) <> ''
                    ) THEN
                        RAISE EXCEPTION 'published listing requires a complete current property';
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1
                        FROM units unit
                        WHERE unit.property_id = target.property_id
                          AND unit.is_marketed
                          AND unit.operational_status = 'READY'
                          AND unit.archived_at IS NULL
                    ) THEN
                        RAISE EXCEPTION 'published listing requires at least one complete marketed unit';
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM units unit
                        WHERE unit.property_id = target.property_id
                          AND unit.is_marketed
                          AND (
                              unit.operational_status <> 'READY'
                              OR unit.archived_at IS NOT NULL
                              OR unit.description IS NULL
                              OR btrim(unit.description) = ''
                              OR unit.area_m2 IS NULL
                              OR unit.advertised_monthly_rent IS NULL
                              OR unit.deposit IS NULL
                              OR unit.max_occupants IS NULL
                              OR NOT EXISTS (
                                  SELECT 1
                                  FROM property_media media
                                  WHERE media.property_id = target.property_id
                                    AND media.unit_id = unit.id
                                    AND media.is_selected_for_listing
                                    AND media.deleted_at IS NULL
                                    AND media.purged_at IS NULL
                              )
                          )
                    ) THEN
                        RAISE EXCEPTION 'every marketed unit must be complete and have selected live media';
                    END IF;
                END IF;
            END;
            $$;

            CREATE OR REPLACE FUNCTION public.validate_listing_cover_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                listing_row record;
            BEGIN
                IF TG_TABLE_NAME = 'listings' THEN
                    PERFORM public.validate_listing_cover(NEW.id);
                ELSIF TG_TABLE_NAME = 'property_media' THEN
                    FOR listing_row IN
                        SELECT id
                        FROM listings
                        WHERE property_id IN (NEW.property_id, OLD.property_id)
                    LOOP
                        PERFORM public.validate_listing_cover(listing_row.id);
                    END LOOP;
                ELSIF TG_TABLE_NAME = 'properties' THEN
                    FOR listing_row IN
                        SELECT id FROM listings WHERE property_id = COALESCE(NEW.id, OLD.id)
                    LOOP
                        PERFORM public.validate_listing_cover(listing_row.id);
                    END LOOP;
                ELSE
                    FOR listing_row IN
                        SELECT id
                        FROM listings
                        WHERE property_id IN (NEW.property_id, OLD.property_id)
                    LOOP
                        PERFORM public.validate_listing_cover(listing_row.id);
                    END LOOP;
                END IF;
                RETURN COALESCE(NEW, OLD);
            END;
            $$;

            CREATE CONSTRAINT TRIGGER listings_cover_integrity
                AFTER INSERT OR UPDATE ON listings
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_listing_cover_trigger();

            CREATE CONSTRAINT TRIGGER property_media_cover_integrity
                AFTER INSERT OR UPDATE OR DELETE ON property_media
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_listing_cover_trigger();

            CREATE CONSTRAINT TRIGGER properties_publication_integrity
                AFTER UPDATE OR DELETE ON properties
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_listing_cover_trigger();

            CREATE CONSTRAINT TRIGGER units_publication_integrity
                AFTER INSERT OR UPDATE OR DELETE ON units
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_listing_cover_trigger();
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.validate_rental_request(request_uuid uuid)
            RETURNS void
            LANGUAGE plpgsql
            AS $$
            DECLARE
                target rental_requests%ROWTYPE;
                tenancy_count integer;
            BEGIN
                SELECT * INTO target FROM rental_requests WHERE id = request_uuid;
                IF NOT FOUND THEN
                    RETURN;
                END IF;

                IF target.preferred_unit_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM listings listing
                    JOIN units unit ON unit.property_id = listing.property_id
                    WHERE listing.id = target.listing_id
                      AND unit.id = target.preferred_unit_id
                ) THEN
                    RAISE EXCEPTION 'preferred unit must belong to the listing property';
                END IF;

                SELECT count(*) INTO tenancy_count
                FROM tenancies
                WHERE rental_request_id = target.id;

                IF target.status = 'ACCEPTED' AND tenancy_count <> 1 THEN
                    RAISE EXCEPTION 'accepted rental request requires exactly one tenancy';
                ELSIF target.status <> 'ACCEPTED' AND tenancy_count <> 0 THEN
                    RAISE EXCEPTION 'tenancy requires an accepted rental request';
                END IF;
            END;
            $$;

            CREATE OR REPLACE FUNCTION public.validate_rental_request_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF TG_TABLE_NAME = 'rental_requests' THEN
                    PERFORM public.validate_rental_request(COALESCE(NEW.id, OLD.id));
                ELSE
                    IF TG_OP <> 'INSERT' AND OLD.rental_request_id IS DISTINCT FROM NEW.rental_request_id THEN
                        PERFORM public.validate_rental_request(OLD.rental_request_id);
                    END IF;
                    PERFORM public.validate_rental_request(COALESCE(NEW.rental_request_id, OLD.rental_request_id));
                END IF;
                RETURN COALESCE(NEW, OLD);
            END;
            $$;

            CREATE CONSTRAINT TRIGGER rental_requests_commit_integrity
                AFTER INSERT OR UPDATE OR DELETE ON rental_requests
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_rental_request_trigger();

            CREATE CONSTRAINT TRIGGER tenancies_request_commit_integrity
                AFTER INSERT OR UPDATE OR DELETE ON tenancies
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_rental_request_trigger();
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.validate_tenancy(tenancy_uuid uuid)
            RETURNS void
            LANGUAGE plpgsql
            AS $$
            DECLARE
                target tenancies%ROWTYPE;
                pending_contract tenancy_contracts%ROWTYPE;
                confirmed_count integer;
                confirmed_start date;
                confirmed_end date;
                overlapping_confirmed_count integer;
                invalid_contract_count integer;
                root_original_count integer;
            BEGIN
                SELECT * INTO target FROM tenancies WHERE id = tenancy_uuid;
                IF NOT FOUND THEN
                    RETURN;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM units unit
                    JOIN properties property ON property.id = unit.property_id
                    JOIN rental_requests request ON request.id = target.rental_request_id
                    JOIN listings listing ON listing.id = request.listing_id
                    WHERE unit.id = target.unit_id
                      AND listing.property_id = unit.property_id
                      AND property.owner_id = target.owner_id
                      AND request.tenant_id = target.tenant_id
                      AND request.status = 'ACCEPTED'
                ) THEN
                    RAISE EXCEPTION 'tenancy parties and unit must match the accepted request property';
                END IF;

                SELECT count(*) INTO invalid_contract_count
                FROM tenancy_contracts contract
                WHERE contract.tenancy_id = target.id
                  AND (
                      (
                          contract.type = 'ORIGINAL'
                          AND contract.version_number > 1
                          AND contract.supersedes_contract_id IS NULL
                      )
                      OR (
                          contract.type = 'RENEWAL'
                          AND contract.supersedes_contract_id IS NULL
                          AND EXISTS (
                              SELECT 1
                              FROM tenancy_contracts predecessor
                              WHERE predecessor.tenancy_id = contract.tenancy_id
                                AND predecessor.renewal_request_id = contract.renewal_request_id
                                AND predecessor.version_number < contract.version_number
                          )
                      )
                      OR (
                          contract.type = 'RENEWAL'
                          AND contract.supersedes_contract_id IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1
                              FROM tenancy_contracts predecessor
                              WHERE predecessor.tenancy_id = contract.tenancy_id
                                AND predecessor.renewal_request_id = contract.renewal_request_id
                                AND predecessor.version_number < contract.version_number
                          )
                      )
                  );

                IF invalid_contract_count > 0 THEN
                    RAISE EXCEPTION 'contract correction requires its exact previous predecessor';
                END IF;

                SELECT count(*) INTO root_original_count
                FROM tenancy_contracts
                WHERE tenancy_id = target.id
                  AND type = 'ORIGINAL'
                  AND supersedes_contract_id IS NULL;

                IF root_original_count <> 1 THEN
                    RAISE EXCEPTION 'tenancy requires exactly one root original contract';
                END IF;

                SELECT count(*) INTO invalid_contract_count
                FROM tenancy_contracts contract
                JOIN units unit ON unit.id = target.unit_id
                WHERE contract.tenancy_id = target.id
                  AND contract.type = 'ORIGINAL'
                  AND contract.end_date
                      < (contract.start_date + make_interval(months => unit.minimum_rental_months))::date - 1;

                IF invalid_contract_count > 0 THEN
                    RAISE EXCEPTION 'original contract does not meet the unit calendar-month minimum';
                END IF;

                SELECT count(*) INTO invalid_contract_count
                FROM tenancy_contracts contract
                WHERE contract.tenancy_id = target.id
                  AND contract.version_number > 1
                  AND NOT EXISTS (
                      SELECT 1
                      FROM tenancy_contracts predecessor
                      WHERE predecessor.tenancy_id = contract.tenancy_id
                        AND predecessor.version_number = contract.version_number - 1
                  );

                IF invalid_contract_count > 0 THEN
                    RAISE EXCEPTION 'contract version numbers must be consecutive per tenancy';
                END IF;

                SELECT count(*) INTO invalid_contract_count
                FROM tenancy_contracts contract
                WHERE contract.tenancy_id = target.id
                  AND contract.supersedes_contract_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM tenancy_contracts predecessor
                      WHERE predecessor.id = contract.supersedes_contract_id
                        AND predecessor.tenancy_id = contract.tenancy_id
                        AND predecessor.version_number = contract.version_number - 1
                        AND predecessor.type = contract.type
                        AND predecessor.tenant_confirmed_at IS NULL
                        AND (
                            contract.type = 'ORIGINAL'
                            OR (
                                predecessor.renewal_request_id = contract.renewal_request_id
                                AND predecessor.basis_contract_id = contract.basis_contract_id
                            )
                        )
                  );

                IF invalid_contract_count > 0 THEN
                    RAISE EXCEPTION 'supersedes predecessor must be exactly the previous eligible unconfirmed version of the same segment';
                END IF;

                SELECT count(*) INTO invalid_contract_count
                FROM tenancy_contracts contract
                WHERE contract.tenancy_id = target.id
                  AND contract.type = 'RENEWAL'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM tenancy_contracts basis
                      WHERE basis.id = contract.basis_contract_id
                        AND basis.tenancy_id = contract.tenancy_id
                        AND basis.tenant_confirmed_at IS NOT NULL
                        AND basis.tenant_rejected_at IS NULL
                        AND contract.start_date = basis.end_date + 1
                        AND contract.end_date > basis.end_date
                  );

                IF invalid_contract_count > 0 THEN
                    RAISE EXCEPTION 'renewal basis must be confirmed and the segment must be consecutive';
                END IF;

                SELECT count(*), min(start_date), max(end_date)
                INTO confirmed_count, confirmed_start, confirmed_end
                FROM tenancy_contracts
                WHERE tenancy_id = target.id
                  AND tenant_confirmed_at IS NOT NULL
                  AND tenant_rejected_at IS NULL;

                SELECT count(*) INTO overlapping_confirmed_count
                FROM tenancy_contracts first_contract
                JOIN tenancy_contracts second_contract
                  ON second_contract.tenancy_id = first_contract.tenancy_id
                 AND second_contract.id > first_contract.id
                 AND daterange(second_contract.start_date, second_contract.end_date + 1, '[)')
                     && daterange(first_contract.start_date, first_contract.end_date + 1, '[)')
                WHERE first_contract.tenancy_id = target.id
                  AND first_contract.tenant_confirmed_at IS NOT NULL
                  AND second_contract.tenant_confirmed_at IS NOT NULL;

                IF overlapping_confirmed_count > 0 THEN
                    RAISE EXCEPTION 'mutually confirmed tenancy segments cannot overlap';
                END IF;

                IF confirmed_count = 0 THEN
                    IF target.confirmed_start_date IS NOT NULL
                        OR target.confirmed_end_date IS NOT NULL
                        OR target.latest_confirmed_contract_id IS NOT NULL THEN
                        RAISE EXCEPTION 'confirmed projections require mutually confirmed contracts';
                    END IF;
                ELSE
                    IF target.confirmed_start_date IS DISTINCT FROM confirmed_start
                        OR target.confirmed_end_date IS DISTINCT FROM confirmed_end THEN
                        RAISE EXCEPTION 'confirmed projections must match mutually confirmed contract segments';
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM tenancy_contracts contract
                        WHERE contract.id = target.latest_confirmed_contract_id
                          AND contract.tenancy_id = target.id
                          AND contract.tenant_confirmed_at IS NOT NULL
                          AND contract.tenant_rejected_at IS NULL
                          AND contract.end_date = confirmed_end
                    ) THEN
                        RAISE EXCEPTION 'latest confirmed pointer must identify the final confirmed segment';
                    END IF;
                END IF;

                IF target.pending_contract_id IS NOT NULL THEN
                    SELECT * INTO pending_contract
                    FROM tenancy_contracts
                    WHERE id = target.pending_contract_id
                      AND tenancy_id = target.id;

                    IF NOT FOUND
                        OR pending_contract.owner_confirmed_at IS NULL
                        OR pending_contract.tenant_confirmed_at IS NOT NULL
                        OR pending_contract.tenant_rejected_at IS NOT NULL
                        OR target.confirmation_expires_at IS NULL THEN
                        RAISE EXCEPTION 'pending pointer requires one owner-confirmed undecided contract and deadline';
                    END IF;

                    IF confirmed_count = 0 THEN
                        IF pending_contract.type <> 'ORIGINAL'
                            OR target.status <> 'PENDING_CONFIRMATION'
                            OR target.blocked_start_date IS DISTINCT FROM pending_contract.start_date
                            OR target.blocked_end_date IS DISTINCT FROM pending_contract.end_date THEN
                            RAISE EXCEPTION 'initial pending contract must exactly define the blocked span';
                        END IF;
                    ELSE
                        IF pending_contract.type <> 'RENEWAL'
                            OR pending_contract.basis_contract_id IS DISTINCT FROM target.latest_confirmed_contract_id
                            OR pending_contract.start_date IS DISTINCT FROM (confirmed_end + 1)
                            OR target.blocked_start_date IS DISTINCT FROM confirmed_start
                            OR target.blocked_end_date IS DISTINCT FROM pending_contract.end_date
                            OR target.status NOT IN ('CONFIRMED', 'ACTIVE')
                            OR NOT EXISTS (
                                SELECT 1
                                FROM tenancy_renewal_requests renewal
                                WHERE renewal.id = pending_contract.renewal_request_id
                                  AND renewal.tenancy_id = target.id
                                  AND renewal.status = 'PENDING'
                            ) THEN
                            RAISE EXCEPTION 'pending renewal must extend the confirmed blocked envelope consecutively';
                        END IF;
                    END IF;
                ELSE
                    IF target.confirmation_expires_at IS NOT NULL THEN
                        RAISE EXCEPTION 'confirmation deadline requires a pending contract';
                    END IF;

                    IF target.status IN ('CONFIRMED', 'ACTIVE') THEN
                        IF confirmed_count = 0
                            OR target.blocked_start_date IS DISTINCT FROM confirmed_start
                            OR target.blocked_end_date IS DISTINCT FROM confirmed_end THEN
                            RAISE EXCEPTION 'confirmed or active tenancy must block its exact confirmed span';
                        END IF;
                    ELSIF target.status IN ('PENDING_CONFIRMATION') THEN
                        RAISE EXCEPTION 'pending confirmation tenancy requires a pending contract';
                    ELSIF target.blocked_start_date IS NOT NULL OR target.blocked_end_date IS NOT NULL THEN
                        RAISE EXCEPTION 'nonblocking tenancy status cannot retain a blocked span';
                    END IF;
                END IF;
            END;
            $$;

            CREATE OR REPLACE FUNCTION public.validate_tenancy_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF TG_TABLE_NAME = 'tenancies' THEN
                    PERFORM public.validate_tenancy(COALESCE(NEW.id, OLD.id));
                ELSE
                    IF TG_OP <> 'INSERT' AND OLD.tenancy_id IS DISTINCT FROM NEW.tenancy_id THEN
                        PERFORM public.validate_tenancy(OLD.tenancy_id);
                    END IF;
                    PERFORM public.validate_tenancy(COALESCE(NEW.tenancy_id, OLD.tenancy_id));
                END IF;
                RETURN COALESCE(NEW, OLD);
            END;
            $$;

            CREATE OR REPLACE FUNCTION public.validate_request_tenancy_parent_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                tenancy_row record;
            BEGIN
                FOR tenancy_row IN
                    SELECT id
                    FROM tenancies
                    WHERE rental_request_id IN (NEW.id, OLD.id)
                LOOP
                    PERFORM public.validate_tenancy(tenancy_row.id);
                END LOOP;
                RETURN COALESCE(NEW, OLD);
            END;
            $$;

            CREATE OR REPLACE FUNCTION public.validate_property_tenancy_owner_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                tenancy_row record;
            BEGIN
                FOR tenancy_row IN
                    SELECT tenancy.id
                    FROM tenancies tenancy
                    JOIN units unit ON unit.id = tenancy.unit_id
                    WHERE unit.property_id IN (NEW.id, OLD.id)
                LOOP
                    PERFORM public.validate_tenancy(tenancy_row.id);
                END LOOP;
                RETURN NEW;
            END;
            $$;

            CREATE CONSTRAINT TRIGGER tenancies_projection_commit_integrity
                AFTER INSERT OR UPDATE OR DELETE ON tenancies
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_tenancy_trigger();

            CREATE CONSTRAINT TRIGGER tenancy_contracts_projection_commit_integrity
                AFTER INSERT OR UPDATE OR DELETE ON tenancy_contracts
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_tenancy_trigger();

            CREATE CONSTRAINT TRIGGER rental_requests_tenancy_parent_commit_integrity
                AFTER UPDATE OF tenant_id, listing_id ON rental_requests
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_request_tenancy_parent_trigger();

            CREATE CONSTRAINT TRIGGER properties_tenancy_owner_commit_integrity
                AFTER UPDATE OF owner_id ON properties
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_property_tenancy_owner_trigger();
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.validate_renewal_request(renewal_uuid uuid)
            RETURNS void
            LANGUAGE plpgsql
            AS $$
            DECLARE
                target tenancy_renewal_requests%ROWTYPE;
                confirmed_count integer;
            BEGIN
                SELECT * INTO target FROM tenancy_renewal_requests WHERE id = renewal_uuid;
                IF NOT FOUND THEN
                    RETURN;
                END IF;

                IF target.status = 'PENDING' AND NOT EXISTS (
                    SELECT 1
                    FROM tenancies tenancy
                    WHERE tenancy.id = target.tenancy_id
                      AND tenancy.status IN ('CONFIRMED', 'ACTIVE')
                      AND tenancy.confirmed_end_date IS NOT NULL
                      AND target.requested_end_date > tenancy.confirmed_end_date
                ) THEN
                    RAISE EXCEPTION 'pending renewal requires a confirmed or active parent and a later end date';
                END IF;

                IF target.status <> 'PENDING' AND EXISTS (
                    SELECT 1
                    FROM tenancies tenancy
                    JOIN tenancy_contracts contract
                      ON contract.id = tenancy.pending_contract_id
                     AND contract.tenancy_id = tenancy.id
                    WHERE tenancy.id = target.tenancy_id
                      AND contract.renewal_request_id = target.id
                ) THEN
                    RAISE EXCEPTION 'terminal renewal request cannot remain the pending contract parent';
                END IF;

                SELECT count(*) INTO confirmed_count
                FROM tenancy_contracts contract
                JOIN tenancies tenancy ON tenancy.id = contract.tenancy_id
                WHERE contract.renewal_request_id = target.id
                  AND contract.tenancy_id = target.tenancy_id
                  AND contract.tenant_confirmed_at IS NOT NULL
                  AND contract.tenant_rejected_at IS NULL
                  AND tenancy.latest_confirmed_contract_id = contract.id;

                IF target.status = 'ACCEPTED' AND confirmed_count <> 1 THEN
                    RAISE EXCEPTION 'accepted renewal requires exactly one mutually confirmed current segment';
                ELSIF target.status <> 'ACCEPTED' AND confirmed_count <> 0 THEN
                    RAISE EXCEPTION 'mutually confirmed renewal requires an accepted request';
                END IF;
            END;
            $$;

            CREATE OR REPLACE FUNCTION public.validate_renewal_request_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF TG_TABLE_NAME = 'tenancy_renewal_requests' THEN
                    PERFORM public.validate_renewal_request(COALESCE(NEW.id, OLD.id));
                ELSE
                    IF TG_OP <> 'INSERT' AND OLD.renewal_request_id IS DISTINCT FROM NEW.renewal_request_id THEN
                        PERFORM public.validate_renewal_request(OLD.renewal_request_id);
                    END IF;
                    IF COALESCE(NEW.renewal_request_id, OLD.renewal_request_id) IS NOT NULL THEN
                        PERFORM public.validate_renewal_request(COALESCE(NEW.renewal_request_id, OLD.renewal_request_id));
                    END IF;
                END IF;
                RETURN COALESCE(NEW, OLD);
            END;
            $$;

            CREATE CONSTRAINT TRIGGER tenancy_renewal_requests_commit_integrity
                AFTER INSERT OR UPDATE OR DELETE ON tenancy_renewal_requests
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_renewal_request_trigger();

            CREATE CONSTRAINT TRIGGER tenancy_contracts_renewal_commit_integrity
                AFTER INSERT OR UPDATE OR DELETE ON tenancy_contracts
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_renewal_request_trigger();
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                RAISE EXCEPTION 'audit logs are append-only';
            END;
            $$;

            CREATE TRIGGER audit_logs_append_only
                BEFORE UPDATE OR DELETE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION public.reject_audit_log_mutation();

            REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES REVOKE ALL ON TYPES FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TYPES FROM PUBLIC;

            DO $$
            DECLARE
                target_role record;
            BEGIN
                FOR target_role IN
                    SELECT rolname
                    FROM pg_roles
                    WHERE rolname IN ('anon', 'authenticated', 'service_role')
                LOOP
                    EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', target_role.rolname);
                    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', target_role.rolname);
                    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', target_role.rolname);
                    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES REVOKE ALL ON TYPES FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', target_role.rolname);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TYPES FROM %I', target_role.rolname);
                END LOOP;
            END;
            $$;
            SQL);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
            DROP TRIGGER IF EXISTS tenancy_contracts_renewal_commit_integrity ON tenancy_contracts;
            DROP TRIGGER IF EXISTS tenancy_renewal_requests_commit_integrity ON tenancy_renewal_requests;
            DROP TRIGGER IF EXISTS tenancy_contracts_projection_commit_integrity ON tenancy_contracts;
            DROP TRIGGER IF EXISTS tenancies_projection_commit_integrity ON tenancies;
            DROP TRIGGER IF EXISTS properties_tenancy_owner_commit_integrity ON properties;
            DROP TRIGGER IF EXISTS rental_requests_tenancy_parent_commit_integrity ON rental_requests;
            DROP TRIGGER IF EXISTS tenancies_request_commit_integrity ON tenancies;
            DROP TRIGGER IF EXISTS rental_requests_commit_integrity ON rental_requests;
            DROP TRIGGER IF EXISTS units_publication_integrity ON units;
            DROP TRIGGER IF EXISTS properties_publication_integrity ON properties;
            DROP TRIGGER IF EXISTS property_media_cover_integrity ON property_media;
            DROP TRIGGER IF EXISTS listings_cover_integrity ON listings;
            DROP TRIGGER IF EXISTS listings_lifecycle_guard ON listings;
            DROP TRIGGER IF EXISTS tenancy_contracts_guard_delete ON tenancy_contracts;
            DROP TRIGGER IF EXISTS tenancy_contracts_guard_insert_update ON tenancy_contracts;
            DROP FUNCTION IF EXISTS public.reject_audit_log_mutation();
            DROP FUNCTION IF EXISTS public.validate_renewal_request_trigger();
            DROP FUNCTION IF EXISTS public.validate_renewal_request(uuid);
            DROP FUNCTION IF EXISTS public.validate_property_tenancy_owner_trigger();
            DROP FUNCTION IF EXISTS public.validate_request_tenancy_parent_trigger();
            DROP FUNCTION IF EXISTS public.validate_tenancy_trigger();
            DROP FUNCTION IF EXISTS public.validate_tenancy(uuid);
            DROP FUNCTION IF EXISTS public.validate_rental_request_trigger();
            DROP FUNCTION IF EXISTS public.validate_rental_request(uuid);
            DROP FUNCTION IF EXISTS public.validate_listing_cover_trigger();
            DROP FUNCTION IF EXISTS public.validate_listing_cover(uuid);
            DROP FUNCTION IF EXISTS public.guard_listing_lifecycle();
            DROP FUNCTION IF EXISTS public.guard_tenancy_contract();

            ALTER TABLE tenancy_contracts
                DROP CONSTRAINT IF EXISTS tenancy_contracts_basis_same_parent_fk,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_supersedes_same_parent_fk,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_renewal_same_parent_fk;

            ALTER TABLE tenancies
                DROP CONSTRAINT IF EXISTS tenancies_latest_contract_same_parent_fk,
                DROP CONSTRAINT IF EXISTS tenancies_pending_contract_same_parent_fk,
                DROP CONSTRAINT IF EXISTS tenancies_no_overlapping_blocked_ranges;

            DROP INDEX IF EXISTS listing_reports_one_open_per_reporter_listing_unique;
            DROP INDEX IF EXISTS tenancy_contracts_one_successor_per_version_unique;
            DROP INDEX IF EXISTS tenancy_contracts_one_confirmed_renewal_fulfillment_unique;
            DROP INDEX IF EXISTS tenancy_renewal_requests_one_pending_unique;
            DROP INDEX IF EXISTS rental_requests_one_pending_per_tenant_listing_unique;
            DROP INDEX IF EXISTS listings_one_current_per_property_unique;
            DROP INDEX IF EXISTS units_property_normalized_label_unique;

            ALTER TABLE personal_access_tokens
                DROP CONSTRAINT IF EXISTS personal_access_tokens_expiry_check,
                DROP CONSTRAINT IF EXISTS personal_access_tokens_abilities_check,
                DROP CONSTRAINT IF EXISTS personal_access_tokens_token_check,
                DROP CONSTRAINT IF EXISTS personal_access_tokens_name_check,
                DROP CONSTRAINT IF EXISTS personal_access_tokens_type_check;

            ALTER TABLE idempotency_records
                DROP CONSTRAINT IF EXISTS idempotency_records_response_status_check,
                DROP CONSTRAINT IF EXISTS idempotency_records_result_ids_check,
                DROP CONSTRAINT IF EXISTS idempotency_records_hash_check;

            ALTER TABLE notifications
                DROP CONSTRAINT IF EXISTS notifications_audience_check;

            ALTER TABLE listing_reports
                DROP CONSTRAINT IF EXISTS listing_reports_resolution_check,
                DROP CONSTRAINT IF EXISTS listing_reports_review_metadata_check,
                DROP CONSTRAINT IF EXISTS listing_reports_revision_check,
                DROP CONSTRAINT IF EXISTS listing_reports_description_not_blank,
                DROP CONSTRAINT IF EXISTS listing_reports_status_check,
                DROP CONSTRAINT IF EXISTS listing_reports_reason_code_check;

            ALTER TABLE tenancy_contracts
                DROP CONSTRAINT IF EXISTS tenancy_contracts_no_self_reference_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_type_links_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_outcome_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_document_sha256_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_policies_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_deposit_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_rent_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_dates_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_type_check,
                DROP CONSTRAINT IF EXISTS tenancy_contracts_version_check;

            ALTER TABLE tenancy_renewal_requests
                DROP CONSTRAINT IF EXISTS tenancy_renewal_requests_rejection_reason_check,
                DROP CONSTRAINT IF EXISTS tenancy_renewal_requests_review_metadata_check,
                DROP CONSTRAINT IF EXISTS tenancy_renewal_requests_revision_check,
                DROP CONSTRAINT IF EXISTS tenancy_renewal_requests_date_check,
                DROP CONSTRAINT IF EXISTS tenancy_renewal_requests_rent_check,
                DROP CONSTRAINT IF EXISTS tenancy_renewal_requests_status_check;

            ALTER TABLE tenancies
                DROP CONSTRAINT IF EXISTS tenancies_move_in_check,
                DROP CONSTRAINT IF EXISTS tenancies_end_metadata_check,
                DROP CONSTRAINT IF EXISTS tenancies_blocking_status_dates_check,
                DROP CONSTRAINT IF EXISTS tenancies_blocked_dates_check,
                DROP CONSTRAINT IF EXISTS tenancies_confirmed_dates_check,
                DROP CONSTRAINT IF EXISTS tenancies_revision_check,
                DROP CONSTRAINT IF EXISTS tenancies_status_check;

            ALTER TABLE rental_requests
                DROP CONSTRAINT IF EXISTS rental_requests_closed_at_check,
                DROP CONSTRAINT IF EXISTS rental_requests_rejection_reason_check,
                DROP CONSTRAINT IF EXISTS rental_requests_contact_phone_not_blank,
                DROP CONSTRAINT IF EXISTS rental_requests_contact_name_not_blank,
                DROP CONSTRAINT IF EXISTS rental_requests_message_not_blank,
                DROP CONSTRAINT IF EXISTS rental_requests_revision_check,
                DROP CONSTRAINT IF EXISTS rental_requests_dates_check,
                DROP CONSTRAINT IF EXISTS rental_requests_status_check;

            ALTER TABLE listings
                DROP CONSTRAINT IF EXISTS listings_suspension_metadata_check,
                DROP CONSTRAINT IF EXISTS listings_rejection_reason_check,
                DROP CONSTRAINT IF EXISTS listings_review_metadata_check,
                DROP CONSTRAINT IF EXISTS listings_submission_metadata_check,
                DROP CONSTRAINT IF EXISTS listings_content_revision_checks,
                DROP CONSTRAINT IF EXISTS listings_submitted_revision_check,
                DROP CONSTRAINT IF EXISTS listings_revision_check,
                DROP CONSTRAINT IF EXISTS listings_publication_status_check,
                DROP CONSTRAINT IF EXISTS listings_moderation_status_check,
                DROP CONSTRAINT IF EXISTS listings_description_not_blank,
                DROP CONSTRAINT IF EXISTS listings_title_not_blank;

            ALTER TABLE property_media
                DROP CONSTRAINT IF EXISTS property_media_purge_check,
                DROP CONSTRAINT IF EXISTS property_media_sha256_check,
                DROP CONSTRAINT IF EXISTS property_media_size_check,
                DROP CONSTRAINT IF EXISTS property_media_revision_check,
                DROP CONSTRAINT IF EXISTS property_media_sort_order_check;

            ALTER TABLE units
                DROP CONSTRAINT IF EXISTS units_marketed_completeness_check,
                DROP CONSTRAINT IF EXISTS units_policy_overrides_check,
                DROP CONSTRAINT IF EXISTS units_amenities_check,
                DROP CONSTRAINT IF EXISTS units_revision_check,
                DROP CONSTRAINT IF EXISTS units_operational_status_check,
                DROP CONSTRAINT IF EXISTS units_max_occupants_check,
                DROP CONSTRAINT IF EXISTS units_minimum_rental_months_check,
                DROP CONSTRAINT IF EXISTS units_deposit_check,
                DROP CONSTRAINT IF EXISTS units_advertised_rent_check,
                DROP CONSTRAINT IF EXISTS units_bathroom_arrangement_check,
                DROP CONSTRAINT IF EXISTS units_bathrooms_check,
                DROP CONSTRAINT IF EXISTS units_bedrooms_check,
                DROP CONSTRAINT IF EXISTS units_area_check,
                DROP CONSTRAINT IF EXISTS units_kind_check,
                DROP CONSTRAINT IF EXISTS units_label_not_blank;

            ALTER TABLE properties
                DROP CONSTRAINT IF EXISTS properties_policies_check,
                DROP CONSTRAINT IF EXISTS properties_shared_amenities_check,
                DROP CONSTRAINT IF EXISTS properties_longitude_check,
                DROP CONSTRAINT IF EXISTS properties_latitude_check,
                DROP CONSTRAINT IF EXISTS properties_revision_check,
                DROP CONSTRAINT IF EXISTS properties_content_revision_check,
                DROP CONSTRAINT IF EXISTS properties_rental_arrangement_check,
                DROP CONSTRAINT IF EXISTS properties_type_check,
                DROP CONSTRAINT IF EXISTS properties_name_not_blank;

            ALTER TABLE users
                DROP CONSTRAINT IF EXISTS users_account_status_check,
                DROP CONSTRAINT IF EXISTS users_email_normalized,
                DROP CONSTRAINT IF EXISTS users_name_not_blank;
            SQL);
    }
};
