<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.guard_tenancy_renewal_request_terms()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'tenancy renewal requests cannot be deleted';
                END IF;

                IF ROW(
                    NEW.id,
                    NEW.tenancy_id,
                    NEW.client_operation_id,
                    NEW.requested_end_date,
                    NEW.proposed_monthly_rent,
                    NEW.message,
                    NEW.created_at
                ) IS DISTINCT FROM ROW(
                    OLD.id,
                    OLD.tenancy_id,
                    OLD.client_operation_id,
                    OLD.requested_end_date,
                    OLD.proposed_monthly_rent,
                    OLD.message,
                    OLD.created_at
                ) THEN
                    RAISE EXCEPTION 'tenancy renewal request terms are immutable';
                END IF;

                RETURN NEW;
            END;
            $$;

            CREATE TRIGGER tenancy_renewal_requests_immutable_guard
                BEFORE UPDATE OR DELETE ON tenancy_renewal_requests
                FOR EACH ROW EXECUTE FUNCTION public.guard_tenancy_renewal_request_terms();
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            DROP TRIGGER IF EXISTS tenancy_renewal_requests_immutable_guard ON tenancy_renewal_requests;
            DROP FUNCTION IF EXISTS public.guard_tenancy_renewal_request_terms();
            SQL);
    }
};
