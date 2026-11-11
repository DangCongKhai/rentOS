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
        Schema::create('listing_reports', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('listing_id');
            $table->uuid('reporter_id');
            $table->uuid('client_operation_id');
            $table->text('reason_code');
            $table->text('description');
            $table->text('status')->default('OPEN');
            $table->text('resolution_summary')->nullable();
            $table->text('internal_notes')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->integer('revision')->default(1);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['reporter_id', 'client_operation_id']);
            $table->foreign('listing_id')->references('id')->on('listings');
            $table->foreign('reporter_id')->references('id')->on('users');
            $table->foreign('reviewed_by')->references('id')->on('users');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('actor_id')->nullable();
            $table->text('entity_type');
            $table->uuid('entity_id');
            $table->text('action');
            $table->jsonb('before_values')->nullable();
            $table->jsonb('after_values')->nullable();
            $table->text('reason')->nullable();
            $table->uuid('correlation_id');
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['entity_type', 'entity_id']);
            $table->index('correlation_id');
            $table->foreign('actor_id')->references('id')->on('users');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('recipient_id');
            $table->text('audience');
            $table->text('event_key');
            $table->text('title');
            $table->text('body');
            $table->text('resource_type');
            $table->uuid('resource_id');
            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['recipient_id', 'event_key']);
            $table->index(['recipient_id', 'audience', 'read_at']);
            $table->foreign('recipient_id')->references('id')->on('users');
        });

        Schema::create('idempotency_records', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('actor_id');
            $table->text('action');
            $table->uuid('client_operation_id');
            $table->text('request_hash');
            $table->text('result_resource_type');
            $table->integer('response_status');
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['actor_id', 'action', 'client_operation_id']);
            $table->foreign('actor_id')->references('id')->on('users');
        });
        DB::statement('ALTER TABLE idempotency_records ADD COLUMN result_ids uuid[] NOT NULL');

        Schema::create('favourite_properties', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->uuid('property_id');
            $table->timestampTz('created_at')->useCurrent();

            $table->primary(['user_id', 'property_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('property_id')->references('id')->on('properties')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('favourite_properties');
        Schema::dropIfExists('idempotency_records');
        Schema::dropIfExists('notification_outbox');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('listing_reports');
    }
};
