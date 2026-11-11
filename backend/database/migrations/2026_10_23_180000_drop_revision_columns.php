<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Optimistic concurrency columns are not part of the current setup.
     * Listing content snapshots stay; they do not depend on a row revision.
     */
    public function up(): void
    {
        $this->replaceListingFunctions(compareListingRevision: false);

        foreach ($this->revisionChecks() as $table => $constraint) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$constraint}");
            DB::statement("ALTER TABLE {$table} DROP COLUMN IF EXISTS revision");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->revisionChecks() as $table => $constraint) {
            DB::statement("ALTER TABLE {$table} ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1");
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$constraint}");
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$constraint} CHECK (revision >= 1)");
        }

        $this->replaceListingFunctions(compareListingRevision: true);
    }

    /**
     * @return array<string, string>
     */
    private function revisionChecks(): array
    {
        return [
            'properties' => 'properties_revision_check',
            'units' => 'units_revision_check',
            'property_media' => 'property_media_revision_check',
            'listings' => 'listings_revision_check',
            'rental_requests' => 'rental_requests_revision_check',
            'tenancies' => 'tenancies_revision_check',
            'tenancy_renewal_requests' => 'tenancy_renewal_requests_revision_check',
            'listing_reports' => 'listing_reports_revision_check',
        ];
    }

    private function replaceListingFunctions(bool $compareListingRevision): void
    {
        $approvalComparison = $compareListingRevision
            ? 'NEW.submitted_revision <> NEW.revision OR NEW.submitted_content_revision <> current_property_revision'
            : 'NEW.submitted_content_revision <> current_property_revision';
        $pendingComparison = $compareListingRevision
            ? 'target.submitted_revision <> target.revision OR target.submitted_content_revision <> current_property_revision'
            : 'target.submitted_content_revision <> current_property_revision';

        DB::unprepared(<<<SQL
            CREATE OR REPLACE FUNCTION public.guard_listing_lifecycle()
            RETURNS trigger
            LANGUAGE plpgsql
            AS \$\$
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

                    IF {$approvalComparison} THEN
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
            \$\$;

            CREATE OR REPLACE FUNCTION public.validate_listing_cover(listing_uuid uuid)
            RETURNS void
            LANGUAGE plpgsql
            AS \$\$
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

                    IF {$pendingComparison} THEN
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
            \$\$;
        SQL);
    }
};
