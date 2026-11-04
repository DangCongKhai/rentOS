<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceMediaRequirement(acceptSharedMedia: true);
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.validate_unit_media_listing_cover()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                listing_row record;
                target_unit uuid;
            BEGIN
                target_unit := COALESCE(NEW.unit_id, OLD.unit_id);
                FOR listing_row IN
                    SELECT listings.id
                    FROM listings
                    JOIN units ON units.property_id = listings.property_id
                    WHERE units.id = target_unit
                LOOP
                    PERFORM public.validate_listing_cover(listing_row.id);
                END LOOP;

                RETURN COALESCE(NEW, OLD);
            END;
            $$;

            DROP TRIGGER IF EXISTS unit_media_cover_integrity ON unit_media;
            CREATE CONSTRAINT TRIGGER unit_media_cover_integrity
                AFTER INSERT OR UPDATE OR DELETE ON unit_media
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION public.validate_unit_media_listing_cover();
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            DROP TRIGGER IF EXISTS unit_media_cover_integrity ON unit_media;
            DROP FUNCTION IF EXISTS public.validate_unit_media_listing_cover();
            SQL);
        $this->replaceMediaRequirement(acceptSharedMedia: false);
    }

    private function replaceMediaRequirement(bool $acceptSharedMedia): void
    {
        $function = DB::selectOne(
            "SELECT pg_get_functiondef('public.validate_listing_cover(uuid)'::regprocedure) AS definition",
        )->definition;

        if (! is_string($function)) {
            throw new RuntimeException('Could not read the listing validation function.');
        }

        $directOnly = '/OR\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+property_media\s+media\s+WHERE\s+media\.property_id\s*=\s*target\.property_id\s+AND\s+media\.unit_id\s*=\s*unit\.id\s+AND\s+media\.is_selected_for_listing\s+AND\s+media\.deleted_at\s+IS\s+NULL\s+AND\s+media\.purged_at\s+IS\s+NULL\s*\)/is';
        $sharedAware = '/OR\s*\(\s*NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+property_media\s+media\s+WHERE\s+media\.property_id\s*=\s*target\.property_id\s+AND\s+media\.unit_id\s*=\s*unit\.id\s+AND\s+media\.is_selected_for_listing\s+AND\s+media\.deleted_at\s+IS\s+NULL\s+AND\s+media\.purged_at\s+IS\s+NULL\s*\)\s+AND\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+unit_media\s+assignment\s+JOIN\s+property_media\s+shared_media\s+ON\s+shared_media\.id\s*=\s*assignment\.media_id\s+WHERE\s+assignment\.unit_id\s*=\s*unit\.id\s+AND\s+assignment\.is_selected_for_listing\s+AND\s+shared_media\.property_id\s*=\s*target\.property_id\s+AND\s+shared_media\.unit_id\s+IS\s+NULL\s+AND\s+shared_media\.is_selected_for_listing\s+AND\s+shared_media\.deleted_at\s+IS\s+NULL\s+AND\s+shared_media\.purged_at\s+IS\s+NULL\s*\)\s*\)/is';

        $sharedClause = <<<'SQL'
OR (
                              NOT EXISTS (
                                  SELECT 1
                                  FROM property_media media
                                  WHERE media.property_id = target.property_id
                                    AND media.unit_id = unit.id
                                    AND media.is_selected_for_listing
                                    AND media.deleted_at IS NULL
                                    AND media.purged_at IS NULL
                              )
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM unit_media assignment
                                  JOIN property_media shared_media ON shared_media.id = assignment.media_id
                                  WHERE assignment.unit_id = unit.id
                                    AND assignment.is_selected_for_listing
                                    AND shared_media.property_id = target.property_id
                                    AND shared_media.unit_id IS NULL
                                    AND shared_media.is_selected_for_listing
                                    AND shared_media.deleted_at IS NULL
                                    AND shared_media.purged_at IS NULL
                              )
                          )
SQL;

        $directClause = <<<'SQL'
OR NOT EXISTS (
                                  SELECT 1
                                  FROM property_media media
                                  WHERE media.property_id = target.property_id
                                    AND media.unit_id = unit.id
                                    AND media.is_selected_for_listing
                                    AND media.deleted_at IS NULL
                                    AND media.purged_at IS NULL
                              )
SQL;

        if ($acceptSharedMedia) {
            if (preg_match($sharedAware, $function) === 1) {
                return;
            }

            $updatedFunction = preg_replace($directOnly, trim($sharedClause), $function, 1, $count);
            if ($updatedFunction === null || $count !== 1) {
                throw new RuntimeException('Could not accept shared media in listing validation.');
            }
        } else {
            $updatedFunction = preg_replace($sharedAware, trim($directClause), $function, 1, $count);
            if ($updatedFunction === null || $count !== 1) {
                throw new RuntimeException('Could not restore the direct-photo listing validation.');
            }
        }

        DB::unprepared($updatedFunction);
    }
};
