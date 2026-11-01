<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            UPDATE properties
            SET shared_amenities = jsonb_set(
                shared_amenities,
                '{standard}',
                ((shared_amenities->'standard') - 'shared_laundry')
                    || CASE
                        WHEN NOT ((shared_amenities->'standard') ? 'laundry')
                            THEN jsonb_build_object('laundry', shared_amenities->'standard'->'shared_laundry')
                        ELSE '{}'::jsonb
                    END,
                true
            )
            WHERE (shared_amenities->'standard') ? 'shared_laundry'
            SQL);
        $this->replaceValidationRules(requireUnitMedia: true, allowUnavailableMarketedUnits: true);
    }

    public function down(): void
    {
        $this->replaceValidationRules(requireUnitMedia: false, allowUnavailableMarketedUnits: false);

    }

    private function replaceValidationRules(bool $requireUnitMedia, bool $allowUnavailableMarketedUnits): void
    {
        $function = DB::selectOne(
            "SELECT pg_get_functiondef('public.validate_listing_cover(uuid)'::regprocedure) AS definition",
        )->definition;

        if (! is_string($function)) {
            throw new RuntimeException('Could not read the listing validation function.');
        }

        $unitFilter = '/WHERE\s+unit\.property_id\s*=\s*target\.property_id\s+AND\s+unit\.is_marketed\s+AND\s+unit\.operational_status\s*=\s*\'READY\'\s+AND\s+unit\.archived_at\s+IS\s+NULL\s+AND\s*\(/is';
        $readyUnitFilter = "WHERE unit.property_id = target.property_id\n                          AND unit.is_marketed\n                          AND unit.operational_status = 'READY'\n                          AND unit.archived_at IS NULL\n                          AND (";
        $allMarketedUnitFilter = "WHERE unit.property_id = target.property_id\n                          AND unit.is_marketed\n                          AND (";

        if ($allowUnavailableMarketedUnits) {
            if (preg_match($unitFilter, $function) === 1) {
                throw new RuntimeException('Expected the original marketed-unit completeness rule.');
            }

            $function = preg_replace(
                '/WHERE\s+unit\.property_id\s*=\s*target\.property_id\s+AND\s+unit\.is_marketed\s+AND\s*\(/is',
                $readyUnitFilter,
                $function,
                1,
                $filterCount,
            );

            if ($function === null || $filterCount !== 1) {
                throw new RuntimeException('Could not limit completeness checks to READY marketed units.');
            }
        } else {
            $function = preg_replace($unitFilter, $allMarketedUnitFilter, $function, 1, $filterCount);
            if ($function === null || $filterCount !== 1) {
                throw new RuntimeException('Could not restore the all-marketed-unit completeness rule.');
            }
        }

        $mediaRequirement = '/OR\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+property_media\s+media\s+WHERE\s+media\.property_id\s*=\s*target\.property_id\s+AND\s+media\.unit_id\s*=\s*unit\.id\s+AND\s+media\.is_selected_for_listing\s+AND\s+media\.deleted_at\s+IS\s+NULL\s+AND\s+media\.purged_at\s+IS\s+NULL\s*\)/is';

        if ($requireUnitMedia && preg_match($mediaRequirement, $function) !== 1) {
            $function = preg_replace_callback(
                '/OR\s+unit\.max_occupants\s+IS\s+NULL/i',
                static fn (array $matches): string => $matches[0]."\n                              OR NOT EXISTS (\n                                  SELECT 1\n                                  FROM property_media media\n                                  WHERE media.property_id = target.property_id\n                                    AND media.unit_id = unit.id\n                                    AND media.is_selected_for_listing\n                                    AND media.deleted_at IS NULL\n                                    AND media.purged_at IS NULL\n                              )",
                $function,
                1,
                $mediaCount,
            );

            if ($function === null || $mediaCount !== 1) {
                throw new RuntimeException('Could not require selected live photos for READY marketed units.');
            }
        } elseif (! $requireUnitMedia) {
            $function = preg_replace($mediaRequirement, '', $function, 1, $mediaCount);
            if ($function === null || $mediaCount !== 1) {
                throw new RuntimeException('Could not remove the READY marketed-unit photo requirement.');
            }
        }

        DB::unprepared($function);
    }
};
