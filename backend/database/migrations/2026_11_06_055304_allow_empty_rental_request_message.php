<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE rental_requests DROP CONSTRAINT rental_requests_message_not_blank');
    }

    public function down(): void
    {
        // Keep requests created with an empty message when rolling back.
        DB::statement("ALTER TABLE rental_requests ADD CONSTRAINT rental_requests_message_not_blank CHECK (btrim(message) <> '') NOT VALID");
    }
};
