<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            ALTER TABLE units
                DROP CONSTRAINT units_marketed_completeness_check,
                ADD CONSTRAINT units_marketed_completeness_check CHECK (
                    NOT is_marketed
                    OR operational_status <> 'READY'
                    OR (
                        description IS NOT NULL
                        AND area_m2 IS NOT NULL
                        AND advertised_monthly_rent IS NOT NULL
                        AND deposit IS NOT NULL
                        AND max_occupants IS NOT NULL
                    )
                )
            SQL);
    }

    public function down(): void
    {
        DB::statement(<<<'SQL'
            ALTER TABLE units
                DROP CONSTRAINT units_marketed_completeness_check,
                ADD CONSTRAINT units_marketed_completeness_check CHECK (
                    NOT is_marketed OR (
                        description IS NOT NULL
                        AND area_m2 IS NOT NULL
                        AND advertised_monthly_rent IS NOT NULL
                        AND deposit IS NOT NULL
                        AND max_occupants IS NOT NULL
                    )
                )
            SQL);
    }
};
