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
        Schema::dropIfExists('notification_outbox');

        if (Schema::hasColumn('notifications', 'audience')) {
            return;
        }

        Schema::table('notifications', function (Blueprint $table) {
            $table->text('audience');
            $table->index(['recipient_id', 'audience', 'read_at']);
        });

        DB::statement("
            ALTER TABLE notifications
                ADD CONSTRAINT notifications_audience_check
                CHECK (audience IN ('ADMIN', 'TENANT', 'OWNER'))
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'audience')) {
            DB::statement('
                ALTER TABLE notifications
                    DROP CONSTRAINT IF EXISTS notifications_audience_check
            ');
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropIndex(['recipient_id', 'audience', 'read_at']);
                $table->dropColumn('audience');
            });
        }

        if (Schema::hasTable('notification_outbox')) {
            return;
        }

        Schema::create('notification_outbox', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->text('event_key')->unique();
            $table->uuid('recipient_id');
            $table->text('event_type');
            $table->jsonb('payload');
            $table->text('status')->default('PENDING');
            $table->integer('attempts')->default(0);
            $table->timestampTz('next_attempt_at')->nullable();
            $table->timestampTz('locked_until')->nullable();
            $table->timestampTz('delivered_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->index(['status', 'next_attempt_at']);
            $table->foreign('recipient_id')->references('id')->on('users');
        });

        DB::statement("
            ALTER TABLE notification_outbox
                ADD CONSTRAINT notification_outbox_status_check
                    CHECK (status IN ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED')),
                ADD CONSTRAINT notification_outbox_attempts_check
                    CHECK (attempts >= 0),
                ADD CONSTRAINT notification_outbox_payload_check
                    CHECK (jsonb_typeof(payload) = 'object')
        ");
    }
};
