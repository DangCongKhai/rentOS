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
        Schema::create('tenancies', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('unit_id');
            $table->uuid('tenant_id');
            $table->uuid('rental_request_id')->unique();
            $table->uuid('client_operation_id');
            $table->text('status')->default('PENDING_CONFIRMATION');
            $table->timestampTz('actual_ended_at')->nullable();
            $table->text('end_reason')->nullable();
            $table->integer('revision')->default(1);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->uuid('owner_id');
            $table->date('confirmed_start_date')->nullable();
            $table->date('confirmed_end_date')->nullable();
            $table->date('blocked_start_date')->nullable();
            $table->date('blocked_end_date')->nullable();
            $table->uuid('pending_contract_id')->nullable();
            $table->uuid('latest_confirmed_contract_id')->nullable();
            $table->timestampTz('confirmation_expires_at')->nullable();
            $table->timestampTz('moved_in_at')->nullable();

            $table->unique(['owner_id', 'client_operation_id']);
            $table->foreign('unit_id')->references('id')->on('units');
            $table->foreign('tenant_id')->references('id')->on('users');
            $table->foreign('rental_request_id')->references('id')->on('rental_requests');
            $table->foreign('owner_id')->references('id')->on('users');
        });

        Schema::create('tenancy_renewal_requests', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('tenancy_id');
            $table->uuid('client_operation_id');
            $table->date('requested_end_date');
            $table->decimal('proposed_monthly_rent', 14, 0);
            $table->text('message')->nullable();
            $table->text('status')->default('PENDING');
            $table->uuid('reviewed_by')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('review_reason')->nullable();
            $table->integer('revision')->default(1);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['tenancy_id', 'client_operation_id']);
            $table->unique(['tenancy_id', 'id']);
            $table->foreign('tenancy_id')->references('id')->on('tenancies');
            $table->foreign('reviewed_by')->references('id')->on('users');
        });

        Schema::create('tenancy_contracts', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('tenancy_id');
            $table->integer('version_number');
            $table->text('type');
            $table->uuid('renewal_request_id')->nullable();
            $table->uuid('supersedes_contract_id')->nullable();
            $table->uuid('basis_contract_id')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('monthly_rent', 14, 0);
            $table->decimal('deposit_amount', 14, 0);
            $table->jsonb('policies_snapshot');
            $table->text('document_path')->unique();
            $table->text('document_sha256');
            $table->date('signed_on')->nullable();
            $table->uuid('created_by');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('owner_confirmed_at');
            $table->timestampTz('tenant_confirmed_at')->nullable();
            $table->timestampTz('tenant_rejected_at')->nullable();
            $table->text('tenant_rejection_reason')->nullable();

            $table->unique(['tenancy_id', 'version_number']);
            $table->unique(['tenancy_id', 'id']);
            $table->foreign('tenancy_id')->references('id')->on('tenancies');
            $table->foreign('created_by')->references('id')->on('users');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenancy_contracts');
        Schema::dropIfExists('tenancy_renewal_requests');
        Schema::dropIfExists('tenancies');
    }
};
