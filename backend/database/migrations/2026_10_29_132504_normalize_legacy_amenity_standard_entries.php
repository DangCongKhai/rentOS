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
        $this->convertBooleanFlags('properties', 'shared_amenities');
        $this->convertBooleanFlags('units', 'amenities');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->restoreBooleanFlags('properties', 'shared_amenities');
        $this->restoreBooleanFlags('units', 'amenities');
    }

    private function convertBooleanFlags(string $table, string $column): void
    {
        DB::statement(<<<SQL
            UPDATE {$table}
            SET {$column} = jsonb_set(
                {$column},
                '{standard}',
                (
                    SELECT COALESCE(
                        jsonb_object_agg(
                            key,
                            CASE
                                WHEN jsonb_typeof(value) = 'boolean'
                                    THEN jsonb_build_object('enabled', value)
                                ELSE value
                            END
                        ),
                        '{}'::jsonb
                    )
                    FROM jsonb_each({$column}->'standard')
                ),
                false
            )
            WHERE jsonb_typeof({$column}->'standard') = 'object'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_each({$column}->'standard') AS amenity(key, value)
                    WHERE jsonb_typeof(value) = 'boolean'
                )
            SQL);
    }

    private function restoreBooleanFlags(string $table, string $column): void
    {
        DB::statement(<<<SQL
            UPDATE {$table}
            SET {$column} = jsonb_set(
                {$column},
                '{standard}',
                (
                    SELECT COALESCE(
                        jsonb_object_agg(
                            key,
                            CASE
                                WHEN jsonb_typeof(value) = 'object'
                                    AND value ? 'enabled'
                                    AND value - 'enabled' = '{}'::jsonb
                                    AND jsonb_typeof(value->'enabled') = 'boolean'
                                    THEN value->'enabled'
                                ELSE value
                            END
                        ),
                        '{}'::jsonb
                    )
                    FROM jsonb_each({$column}->'standard')
                ),
                false
            )
            WHERE jsonb_typeof({$column}->'standard') = 'object'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_each({$column}->'standard') AS amenity(key, value)
                    WHERE jsonb_typeof(value) = 'object'
                        AND value ? 'enabled'
                        AND value - 'enabled' = '{}'::jsonb
                        AND jsonb_typeof(value->'enabled') = 'boolean'
                )
            SQL);
    }
};
