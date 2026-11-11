<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Upgrade the unpublished bigint Laravel auth skeleton without losing identity links.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            throw new RuntimeException('The legacy auth UUID upgrade requires PostgreSQL.');
        }

        $schema = DB::scalar('select current_schema()');
        $userIdType = $this->columnType($schema, 'users', 'id');

        $this->upgradePasswordResetTokens($schema);

        if ($userIdType === 'uuid') {
            $this->assertUuidReference($schema, 'sessions', 'user_id');
            $this->assertUuidReference($schema, 'personal_access_tokens', 'tokenable_id');

            return;
        }

        if (! in_array($userIdType, ['bigint', 'integer'], true)) {
            throw new RuntimeException("Cannot upgrade users.id from unsupported type {$userIdType}.");
        }

        DB::statement('ALTER TABLE users ADD COLUMN id_uuid uuid DEFAULT gen_random_uuid() NOT NULL');
        DB::statement('ALTER TABLE sessions ADD COLUMN user_id_uuid uuid NULL');
        DB::statement('ALTER TABLE personal_access_tokens ADD COLUMN tokenable_id_uuid uuid NULL');

        DB::statement(
            'UPDATE sessions AS session
             SET user_id_uuid = users.id_uuid
             FROM users
             WHERE session.user_id = users.id',
        );
        DB::statement(
            'UPDATE personal_access_tokens AS token
             SET tokenable_id_uuid = users.id_uuid
             FROM users
             WHERE token.tokenable_id = users.id
               AND token.tokenable_type = ?',
            ['App\\Models\\User'],
        );

        if (DB::table('sessions')->whereNotNull('user_id')->whereNull('user_id_uuid')->exists()) {
            throw new RuntimeException('Legacy sessions contain an orphaned users.id reference.');
        }

        if (DB::table('personal_access_tokens')->where('tokenable_type', '<>', 'App\\Models\\User')->exists()) {
            throw new RuntimeException('Legacy personal access tokens contain an unsupported tokenable type.');
        }

        if (DB::table('personal_access_tokens')->whereNull('tokenable_id_uuid')->exists()) {
            throw new RuntimeException('Legacy personal access tokens contain an orphaned users.id reference.');
        }

        if (DB::query()->fromSub(
            DB::table('users')
                ->selectRaw('lower(btrim(email)) AS normalized_email')
                ->groupByRaw('lower(btrim(email))')
                ->havingRaw('count(*) > 1'),
            'duplicate_emails',
        )->exists()) {
            throw new RuntimeException('Legacy users contain duplicate normalized email addresses.');
        }

        DB::statement('UPDATE users SET email = lower(btrim(email))');
        DB::statement(<<<'SQL'
            UPDATE personal_access_tokens
            SET abilities = '[]'
            WHERE abilities IS NULL
               OR NOT (
                   jsonb_typeof(abilities::jsonb) = 'array'
                   AND abilities::jsonb <@ '["account:read","favourites:read","favourites:write"]'::jsonb
               )
            SQL);
        DB::statement(<<<'SQL'
            UPDATE personal_access_tokens
            SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
                updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
                expires_at = COALESCE(expires_at, created_at + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '30 days')
            SQL);
        DB::statement(<<<'SQL'
            UPDATE users
            SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
                updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
            SQL);

        $this->dropForeignKeysForColumn($schema, 'sessions', 'user_id');
        $this->dropForeignKeysForColumn($schema, 'personal_access_tokens', 'tokenable_id');

        DB::statement('DROP INDEX IF EXISTS sessions_user_id_index');
        DB::statement('DROP INDEX IF EXISTS personal_access_tokens_tokenable_type_tokenable_id_index');

        DB::unprepared(<<<'SQL'
            ALTER TABLE sessions DROP COLUMN user_id;
            ALTER TABLE sessions RENAME COLUMN user_id_uuid TO user_id;

            ALTER TABLE personal_access_tokens DROP COLUMN tokenable_id;
            ALTER TABLE personal_access_tokens RENAME COLUMN tokenable_id_uuid TO tokenable_id;
            ALTER TABLE personal_access_tokens ALTER COLUMN tokenable_id SET NOT NULL;

            ALTER TABLE users DROP CONSTRAINT users_pkey;
            ALTER TABLE users DROP COLUMN id;
            ALTER TABLE users RENAME COLUMN id_uuid TO id;
            ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
            ALTER TABLE users ALTER COLUMN name TYPE text;
            ALTER TABLE users ALTER COLUMN email TYPE text;
            ALTER TABLE users
                ALTER COLUMN email_verified_at TYPE timestamptz
                    USING email_verified_at AT TIME ZONE 'UTC',
                ALTER COLUMN created_at TYPE timestamptz
                    USING created_at AT TIME ZONE 'UTC',
                ALTER COLUMN updated_at TYPE timestamptz
                    USING updated_at AT TIME ZONE 'UTC',
                ALTER COLUMN created_at SET NOT NULL,
                ALTER COLUMN updated_at SET NOT NULL,
                ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
                ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

            ALTER TABLE personal_access_tokens
                ALTER COLUMN name TYPE varchar(255),
                ALTER COLUMN token TYPE char(64),
                ALTER COLUMN abilities SET NOT NULL,
                ALTER COLUMN last_used_at TYPE timestamptz
                    USING last_used_at AT TIME ZONE 'UTC',
                ALTER COLUMN expires_at TYPE timestamptz
                    USING expires_at AT TIME ZONE 'UTC',
                ALTER COLUMN created_at TYPE timestamptz
                    USING created_at AT TIME ZONE 'UTC',
                ALTER COLUMN updated_at TYPE timestamptz
                    USING updated_at AT TIME ZONE 'UTC',
                ALTER COLUMN expires_at SET NOT NULL,
                ALTER COLUMN created_at SET NOT NULL,
                ALTER COLUMN updated_at SET NOT NULL,
                ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
                ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

            DO $$
            DECLARE
                serial_sequence text;
                identity_start bigint;
            BEGIN
                SELECT pg_get_serial_sequence('personal_access_tokens', 'id')
                INTO serial_sequence;
                SELECT COALESCE(max(id), 0) + 1
                INTO identity_start
                FROM personal_access_tokens;

                ALTER TABLE personal_access_tokens ALTER COLUMN id DROP DEFAULT;

                IF serial_sequence IS NOT NULL THEN
                    EXECUTE format('ALTER SEQUENCE %s OWNED BY NONE', serial_sequence);
                    EXECUTE format('DROP SEQUENCE %s', serial_sequence);
                END IF;

                EXECUTE format(
                    'ALTER TABLE personal_access_tokens ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (START WITH %s)',
                    identity_start
                );
            END;
            $$;

            CREATE INDEX sessions_user_id_index ON sessions (user_id);
            CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index
                ON personal_access_tokens (tokenable_type, tokenable_id);

            ALTER TABLE sessions
                ADD CONSTRAINT sessions_user_id_foreign
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
            ALTER TABLE personal_access_tokens
                ADD CONSTRAINT personal_access_tokens_tokenable_id_foreign
                FOREIGN KEY (tokenable_id) REFERENCES users (id) ON DELETE CASCADE;
            SQL);
    }

    /**
     * The bigint identifiers cannot be reconstructed after their safe UUID replacement.
     */
    public function down(): void
    {
        // Forward-only data conversion. Fresh UUID installations never change in up().
    }

    private function assertUuidReference(string $schema, string $table, string $column): void
    {
        $type = $this->columnType($schema, $table, $column);

        if ($type !== 'uuid') {
            throw new RuntimeException("{$table}.{$column} must be uuid when users.id is uuid; found {$type}.");
        }
    }

    private function upgradePasswordResetTokens(string $schema): void
    {
        $emailType = $this->columnType($schema, 'password_reset_tokens', 'email');
        $createdAtType = $this->columnType($schema, 'password_reset_tokens', 'created_at');

        if ($emailType === null || $createdAtType === null) {
            throw new RuntimeException('password_reset_tokens must exist before the legacy auth upgrade.');
        }

        if (DB::query()->fromSub(
            DB::table('password_reset_tokens')
                ->selectRaw('lower(btrim(email)) AS normalized_email')
                ->groupByRaw('lower(btrim(email))')
                ->havingRaw('count(*) > 1'),
            'duplicate_reset_emails',
        )->exists()) {
            throw new RuntimeException('Legacy password reset tokens contain duplicate normalized email addresses.');
        }

        DB::statement('UPDATE password_reset_tokens SET email = lower(btrim(email))');

        if ($emailType !== 'text') {
            DB::statement('ALTER TABLE password_reset_tokens ALTER COLUMN email TYPE text');
        }

        if ($createdAtType === 'timestamp without time zone') {
            DB::statement(
                "ALTER TABLE password_reset_tokens
                 ALTER COLUMN created_at TYPE timestamptz
                 USING created_at AT TIME ZONE 'UTC'",
            );
        } elseif ($createdAtType !== 'timestamp with time zone') {
            throw new RuntimeException(
                "Cannot upgrade password_reset_tokens.created_at from unsupported type {$createdAtType}.",
            );
        }
    }

    private function columnType(string $schema, string $table, string $column): ?string
    {
        return DB::table('information_schema.columns')
            ->where('table_schema', $schema)
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->value('data_type');
    }

    private function dropForeignKeysForColumn(string $schema, string $table, string $column): void
    {
        $constraints = DB::select(
            <<<'SQL'
                SELECT constraint_name
                FROM information_schema.key_column_usage
                WHERE table_schema = ?
                  AND table_name = ?
                  AND column_name = ?
                  AND constraint_name IN (
                      SELECT constraint_name
                      FROM information_schema.table_constraints
                      WHERE table_schema = ?
                        AND table_name = ?
                        AND constraint_type = 'FOREIGN KEY'
                  )
                SQL,
            [$schema, $table, $column, $schema, $table],
        );

        foreach ($constraints as $constraint) {
            $constraintName = str_replace('"', '""', $constraint->constraint_name);
            $tableName = str_replace('"', '""', $table);
            DB::statement("ALTER TABLE \"{$tableName}\" DROP CONSTRAINT \"{$constraintName}\"");
        }
    }
};
