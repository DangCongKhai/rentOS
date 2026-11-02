<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceUnitMediaRequirement(requireUnitMedia: false);
    }

    public function down(): void
    {
        $this->replaceUnitMediaRequirement(requireUnitMedia: true);
    }

    private function replaceUnitMediaRequirement(bool $requireUnitMedia): void
    {
        $function = DB::selectOne(
            "SELECT pg_get_functiondef('public.validate_listing_cover(uuid)'::regprocedure) AS definition",
        )->definition;

        if (! is_string($function)) {
            throw new RuntimeException('Could not read the listing validation function.');
        }

        $mediaRequirement = '/OR\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+property_media\s+media\s+WHERE\s+media\.property_id\s*=\s*target\.property_id\s+AND\s+media\.unit_id\s*=\s*unit\.id\s+AND\s+media\.is_selected_for_listing\s+AND\s+media\.deleted_at\s+IS\s+NULL\s+AND\s+media\.purged_at\s+IS\s+NULL\s*\)/is';

        if ($requireUnitMedia) {
            if (preg_match($mediaRequirement, $function) === 1) {
                return;
            }

            $updatedFunction = preg_replace_callback(
                '/OR\s+unit\.max_occupants\s+IS\s+NULL/i',
                static fn (array $matches): string => $matches[0]."\n                              OR NOT EXISTS (\n                                  SELECT 1\n                                  FROM property_media media\n                                  WHERE media.property_id = target.property_id\n                                    AND media.unit_id = unit.id\n                                    AND media.is_selected_for_listing\n                                    AND media.deleted_at IS NULL\n                                    AND media.purged_at IS NULL\n                              )",
                $function,
                1,
                $replacementCount,
            );

            if ($updatedFunction === null || $replacementCount !== 1) {
                throw new RuntimeException('Could not restore the unit media requirement.');
            }

            $updatedFunction = str_replace(
                "RAISE EXCEPTION 'every marketed unit must be complete';",
                "RAISE EXCEPTION 'every marketed unit must be complete and have selected live media';",
                $updatedFunction,
                $messageReplacementCount,
            );

            if ($messageReplacementCount !== 1) {
                throw new RuntimeException('Could not restore the listing validation message.');
            }
        } else {
            $updatedFunction = preg_replace($mediaRequirement, '', $function, -1, $replacementCount);

            if ($updatedFunction === null || $replacementCount !== 1) {
                throw new RuntimeException('Could not remove the unit media requirement.');
            }

            $updatedFunction = str_replace(
                "RAISE EXCEPTION 'every marketed unit must be complete and have selected live media';",
                "RAISE EXCEPTION 'every marketed unit must be complete';",
                $updatedFunction,
                $messageReplacementCount,
            );

            if ($messageReplacementCount !== 1) {
                throw new RuntimeException('Could not update the listing validation message.');
            }
        }

        DB::unprepared($updatedFunction);
    }
};
