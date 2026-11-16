<?php

namespace App\Console\Commands;

use App\Actions\Tenancies\ExpireTenancyReservation;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('tenancies:expire-confirmations')]
#[Description('Expire due tenancy confirmation reservations and release their holds.')]
class ExpireTenancyReservations extends Command
{
    public function handle(ExpireTenancyReservation $expiry): int
    {
        $expired = 0;
        DB::table('tenancies')
            ->whereNotNull('pending_contract_id')
            ->whereNotNull('confirmation_expires_at')
            ->where('confirmation_expires_at', '<=', now())
            ->orderBy('id')
            ->chunkById(100, function ($tenancies) use ($expiry, &$expired): void {
                foreach ($tenancies as $tenancy) {
                    if ($expiry->handle(
                        (string) $tenancy->id,
                        (string) $tenancy->pending_contract_id,
                        (string) $tenancy->confirmation_expires_at,
                    )) {
                        $expired++;
                    }
                }
            });

        $this->info("Expired {$expired} tenancy reservation(s).");

        return self::SUCCESS;
    }
}
