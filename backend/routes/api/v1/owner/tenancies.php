<?php

use App\Http\Controllers\Api\V1\OwnerTenancyProposalsController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')
    ->prefix('v1')
    ->name('api.v1.owner.')
    ->group(function (): void {
        Route::post(
            '/owner/rental-requests/{rentalRequest}/proposal',
            [OwnerTenancyProposalsController::class, 'store'],
        )->name('rental-requests.proposal');
    });