<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        DB::statement('CREATE EXTENSION IF NOT EXISTS unaccent');

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.immutable_unaccent(input text)
            RETURNS text
            LANGUAGE sql
            IMMUTABLE
            PARALLEL SAFE
            STRICT
            AS $$
                SELECT public.unaccent('public.unaccent'::regdictionary, input)
            $$;
        SQL);

        DB::statement('CREATE INDEX properties_address_line_trgm_idx ON properties USING gin (lower(public.immutable_unaccent(address_line)) gin_trgm_ops)');
        DB::statement('CREATE INDEX properties_ward_trgm_idx ON properties USING gin (lower(public.immutable_unaccent(ward)) gin_trgm_ops)');
        DB::statement('CREATE INDEX properties_city_trgm_idx ON properties USING gin (lower(public.immutable_unaccent(city)) gin_trgm_ops)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS properties_city_trgm_idx');
        DB::statement('DROP INDEX IF EXISTS properties_ward_trgm_idx');
        DB::statement('DROP INDEX IF EXISTS properties_address_line_trgm_idx');
        DB::statement('DROP FUNCTION IF EXISTS public.immutable_unaccent(text)');
    }
};
