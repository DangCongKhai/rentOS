<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shared seed images are referenced by many property_media rows.
     * Rollback can restore uniqueness only when no duplicate paths remain.
     */
    public function up(): void
    {
        Schema::table('property_media', function (Blueprint $table): void {
            $table->dropUnique('property_media_storage_path_unique');
            $table->index('storage_path', 'property_media_storage_path_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $duplicate = DB::table('property_media')
            ->select('storage_path')
            ->groupBy('storage_path')
            ->havingRaw('count(*) > 1')
            ->first();

        if ($duplicate !== null) {
            throw new RuntimeException(
                'Cannot restore the unique storage_path index while duplicate paths exist. Deduplicate property_media first.',
            );
        }

        Schema::table('property_media', function (Blueprint $table): void {
            $table->dropIndex('property_media_storage_path_index');
            $table->unique('storage_path');
        });
    }
};
