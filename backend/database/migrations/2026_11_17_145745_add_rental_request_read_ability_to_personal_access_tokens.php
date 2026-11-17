<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table): void {
            $table->timestampTz('expires_at')->nullable()->change();
        });

        DB::statement(<<<'SQL'
            ALTER TABLE personal_access_tokens
                DROP CONSTRAINT personal_access_tokens_abilities_check,
                ADD CONSTRAINT personal_access_tokens_abilities_check CHECK (
                    jsonb_typeof(abilities::jsonb) = 'array'
                    AND abilities::jsonb <@ '["account:read","favourites:read","favourites:write","rental-requests:read"]'::jsonb
                )
        SQL);
    }

    public function down(): void
    {
        if (DB::table('personal_access_tokens')->whereNull('expires_at')->exists()) {
            throw new RuntimeException('Set an expiry on all non-expiring tokens before rolling back this migration.');
        }

        $hasRentalRequestTokens = DB::table('personal_access_tokens')
            ->whereRaw("abilities::jsonb ? 'rental-requests:read'")
            ->exists();

        if ($hasRentalRequestTokens) {
            throw new RuntimeException('Revoke all rental-requests:read tokens before rolling back this migration.');
        }

        DB::statement(<<<'SQL'
            ALTER TABLE personal_access_tokens
                DROP CONSTRAINT personal_access_tokens_abilities_check,
                ADD CONSTRAINT personal_access_tokens_abilities_check CHECK (
                    jsonb_typeof(abilities::jsonb) = 'array'
                    AND abilities::jsonb <@ '["account:read","favourites:read","favourites:write"]'::jsonb
                )
        SQL);

        Schema::table('personal_access_tokens', function (Blueprint $table): void {
            $table->timestampTz('expires_at')->nullable(false)->change();
        });
    }
};
