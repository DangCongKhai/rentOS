<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('unit_media', function (Blueprint $table) {
            $table->uuid('unit_id');
            $table->uuid('media_id');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_selected_for_listing')->default(true);
            $table->timestampTz('created_at')->useCurrent();

            $table->primary(['unit_id', 'media_id']);
            $table->foreign('unit_id')->references('id')->on('units')->cascadeOnDelete();
            $table->foreign('media_id')->references('id')->on('property_media')->cascadeOnDelete();
            $table->index('media_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('unit_media');
    }
};
