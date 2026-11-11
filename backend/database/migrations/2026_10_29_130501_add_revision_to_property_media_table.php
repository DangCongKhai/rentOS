<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('property_media', function (Blueprint $table): void {
            $table->integer('revision')->default(1);
        });

        DB::statement('ALTER TABLE property_media ADD CONSTRAINT property_media_revision_check CHECK (revision >= 1)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE property_media DROP CONSTRAINT IF EXISTS property_media_revision_check');

        Schema::table('property_media', function (Blueprint $table): void {
            $table->dropColumn('revision');
        });
    }
};
