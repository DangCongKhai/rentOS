<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceGalleryRequirement(acceptPropertyGallery: true);
    }

    public function down(): void
    {
        $this->replaceGalleryRequirement(acceptPropertyGallery: false);
    }

    private function replaceGalleryRequirement(bool $acceptPropertyGallery): void
    {
        $function = DB::selectOne(
            "SELECT pg_get_functiondef('public.validate_listing_cover(uuid)'::regprocedure) AS definition",
        )->definition;

        if (! is_string($function)) {
            throw new RuntimeException('Could not read the listing validation function.');
        }

        $assignment = '/AND NOT EXISTS \(\s*SELECT 1\s+FROM unit_media assignment\s+JOIN property_media shared_media ON shared_media\.id = assignment\.media_id\s+WHERE assignment\.unit_id = unit\.id\s+AND assignment\.is_selected_for_listing\s+AND shared_media\.property_id = target\.property_id\s+AND shared_media\.unit_id IS NULL\s+AND shared_media\.is_selected_for_listing\s+AND shared_media\.deleted_at IS NULL\s+AND shared_media\.purged_at IS NULL\s*\)/is';
        $gallery = '/AND NOT EXISTS \(\s*SELECT 1\s+FROM properties whole_property\s+JOIN property_media gallery ON gallery\.property_id = whole_property\.id\s+WHERE whole_property\.id = target\.property_id\s+AND whole_property\.rental_arrangement = \'WHOLE_SPACE\'\s+AND gallery\.unit_id IS NULL\s+AND gallery\.is_selected_for_listing\s+AND gallery\.deleted_at IS NULL\s+AND gallery\.purged_at IS NULL\s*\)/is';

        $galleryClause = <<<'SQL'
AND NOT EXISTS (
                                  SELECT 1
                                  FROM properties whole_property
                                  JOIN property_media gallery ON gallery.property_id = whole_property.id
                                  WHERE whole_property.id = target.property_id
                                    AND whole_property.rental_arrangement = 'WHOLE_SPACE'
                                    AND gallery.unit_id IS NULL
                                    AND gallery.is_selected_for_listing
                                    AND gallery.deleted_at IS NULL
                                    AND gallery.purged_at IS NULL
                              )
SQL;

        if ($acceptPropertyGallery) {
            if (preg_match($gallery, $function) === 1) {
                return;
            }

            $updatedFunction = preg_replace($assignment, '$0'."\n                              ".trim($galleryClause), $function, 1, $count);
            if ($updatedFunction === null || $count !== 1) {
                throw new RuntimeException('Could not accept the property gallery for a whole-space listing.');
            }
        } else {
            $updatedFunction = preg_replace($gallery, '', $function, 1, $count);
            if ($updatedFunction === null || $count !== 1) {
                throw new RuntimeException('Could not remove the whole-space property gallery check.');
            }
        }

        DB::unprepared($updatedFunction);
    }
};
