<?php

use App\Http\Controllers\Api\V1\OwnerTenancyLifecycleController;
use App\Http\Controllers\Api\V1\OwnerTenancyProposalsController;
use App\Http\Controllers\Api\V1\TenancyTimelineController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')
    ->prefix('v1')
    ->name('api.v1.owner.')
    ->group(function (): void {
        Route::post(
            '/owner/rental-requests/{rentalRequest}/proposal',
            [OwnerTenancyProposalsController::class, 'store'],
        )->name('rental-requests.proposal');
        Route::post(
            '/owner/tenancies/{tenancy}/correction',
            [OwnerTenancyProposalsController::class, 'correct'],
        )->name('tenancies.correction');
        Route::post(
            '/owner/tenancies/{tenancy}/move-in',
            [OwnerTenancyLifecycleController::class, 'moveIn'],
        )->name('tenancies.move-in');
        Route::post(
            '/owner/tenancies/{tenancy}/cancel',
            [OwnerTenancyLifecycleController::class, 'cancel'],
        )->name('tenancies.cancel');
        Route::post(
            '/owner/tenancies/{tenancy}/end',
            [OwnerTenancyLifecycleController::class, 'end'],
        )->name('tenancies.end');
        Route::get(
            '/owner/tenancies/{tenancy}',
            [TenancyTimelineController::class, 'show'],
        )->name('tenancies.show');
        Route::get(
            '/owner/tenancies',
            [TenancyTimelineController::class, 'ownerIndex'],
        )->name('tenancies.index');
    });
