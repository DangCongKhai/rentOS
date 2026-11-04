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
        Schema::create('properties', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('owner_id');
            $table->uuid('client_operation_id');
            $table->text('name');
            $table->text('property_type');
            $table->text('rental_arrangement');
            $table->text('address_line')->nullable();
            $table->text('ward')->nullable();
            $table->text('district')->nullable();
            $table->text('city')->nullable();
            $table->text('description')->nullable();
            $table->jsonb('shared_amenities')->default(
                DB::raw('\'{"schema_version":1,"standard":{},"custom":[]}\'::jsonb'),
            );
            $table->jsonb('policies');
            $table->integer('content_revision')->default(1);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->integer('revision')->default(1);

            $table->unique(['owner_id', 'client_operation_id']);
            $table->foreign('owner_id')->references('id')->on('users');
        });

        Schema::create('units', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('property_id');
            $table->uuid('client_operation_id');
            $table->text('label');
            $table->text('unit_kind');
            $table->text('description')->nullable();
            $table->text('floor')->nullable();
            $table->decimal('area_m2', 12, 2)->nullable();
            $table->integer('bedrooms');
            $table->integer('bathrooms');
            $table->text('bathroom_arrangement');
            $table->jsonb('amenities')->default(
                DB::raw('\'{"schema_version":1,"standard":{},"custom":[]}\'::jsonb'),
            );
            $table->decimal('advertised_monthly_rent', 14, 0)->nullable();
            $table->decimal('deposit', 14, 0)->nullable();
            $table->integer('minimum_rental_months');
            $table->integer('max_occupants')->nullable();
            $table->text('operational_status')->default('READY');
            $table->boolean('is_marketed')->default(false);
            $table->jsonb('policy_overrides')->default(DB::raw('\'{}\'::jsonb'));
            $table->integer('revision')->default(1);
            $table->timestampTz('archived_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['property_id', 'client_operation_id']);
            $table->unique(['property_id', 'id']);
            $table->foreign('property_id')->references('id')->on('properties');
        });

        Schema::create('property_media', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('property_id');
            $table->uuid('unit_id')->nullable();
            $table->uuid('uploaded_by');
            $table->uuid('client_operation_id');
            $table->text('storage_path')->unique();
            $table->text('caption')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_selected_for_listing')->default(true);
            $table->integer('revision')->default(1);
            $table->timestampTz('purged_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
            $table->text('sha256');
            $table->text('mime_type');
            $table->bigInteger('size_bytes');

            $table->unique(['uploaded_by', 'client_operation_id']);
            $table->unique(['property_id', 'id']);
            $table->foreign('property_id')->references('id')->on('properties');
            $table->foreign('uploaded_by')->references('id')->on('users');
            $table->foreign(['property_id', 'unit_id'])
                ->references(['property_id', 'id'])
                ->on('units');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_media');
        Schema::dropIfExists('units');
        Schema::dropIfExists('properties');
    }
};
