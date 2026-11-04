<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE units DROP CONSTRAINT IF EXISTS units_bathrooms_check');
        DB::statement('ALTER TABLE units ALTER COLUMN bathrooms TYPE integer USING ROUND(bathrooms)::integer');
        DB::statement('ALTER TABLE units ADD CONSTRAINT units_bathrooms_check CHECK (bathrooms >= 0)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE units DROP CONSTRAINT IF EXISTS units_bathrooms_check');
        DB::statement('ALTER TABLE units ALTER COLUMN bathrooms TYPE numeric(6, 2) USING bathrooms::numeric(6, 2)');
        DB::statement('ALTER TABLE units ADD CONSTRAINT units_bathrooms_check CHECK (bathrooms >= 0)');
    }
};
