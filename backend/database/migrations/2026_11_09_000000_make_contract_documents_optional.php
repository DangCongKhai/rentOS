<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            ALTER TABLE tenancy_contracts
                ALTER COLUMN document_path DROP NOT NULL,
                ALTER COLUMN document_sha256 DROP NOT NULL
        SQL);
    }

    public function down(): void
    {
        DB::statement(<<<'SQL'
            ALTER TABLE tenancy_contracts
                ALTER COLUMN document_path SET NOT NULL,
                ALTER COLUMN document_sha256 SET NOT NULL
        SQL);
    }
};
