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
        Schema::create('listings', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('property_id');
            $table->uuid('client_operation_id');
            $table->text('title');
            $table->text('description');
            $table->uuid('cover_media_id')->nullable();
            $table->text('moderation_status')->default('DRAFT');
            $table->text('publication_status')->default('DRAFT');
            $table->integer('revision')->default(1);
            $table->integer('submitted_revision')->nullable();
            $table->timestampTz('submitted_at')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('review_reason')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->integer('submitted_content_revision')->nullable();
            $table->integer('approved_content_revision')->nullable();
            $table->timestampTz('admin_suspended_at')->nullable();
            $table->uuid('admin_suspended_by')->nullable();
            $table->text('suspension_reason')->nullable();

            $table->unique(['property_id', 'client_operation_id']);
            $table->unique(['property_id', 'id']);
            $table->foreign('property_id')->references('id')->on('properties');
            $table->foreign('reviewed_by')->references('id')->on('users');
            $table->foreign('admin_suspended_by')->references('id')->on('users');
            $table->foreign(['property_id', 'cover_media_id'])
                ->references(['property_id', 'id'])
                ->on('property_media');
        });

        Schema::create('rental_requests', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('listing_id');
            $table->uuid('tenant_id');
            $table->uuid('preferred_unit_id')->nullable();
            $table->uuid('client_operation_id');
            $table->date('desired_move_in_date');
            $table->text('message');
            $table->text('status')->default('PENDING');
            $table->text('outcome_reason')->nullable();
            $table->integer('revision')->default(1);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('contact_name');
            $table->text('contact_phone');
            $table->date('desired_end_date');
            $table->timestampTz('availability_checked_at')->nullable();
            $table->timestampTz('closed_at')->nullable();

            $table->unique(['tenant_id', 'client_operation_id']);
            $table->foreign('listing_id')->references('id')->on('listings');
            $table->foreign('tenant_id')->references('id')->on('users');
            $table->foreign('preferred_unit_id')->references('id')->on('units');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rental_requests');
        Schema::dropIfExists('listings');
    }
};
