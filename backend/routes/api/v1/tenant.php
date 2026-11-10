<?php

use App\Http\Controllers\Api\V1\TenancyTimelineController;
use App\Http\Controllers\Api\V1\TenantRentalRequestsController;
use App\Http\Controllers\Api\V1\TenantTenanciesController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.')->group(function (): void {
    Route::get('/tenant/tenancies', [TenantTenanciesController::class, 'index'])->name('tenant.tenancies');
    Route::get('/tenant/tenancies/{tenancy}', [TenancyTimelineController::class, 'show'])
        ->name('tenant.tenancies.show');
    Route::post(
        '/tenant/tenancies/{tenancy}/contracts/{contract}/confirm',
        [TenantTenanciesController::class, 'confirmContract'],
    )->name('tenant.tenancies.contracts.confirm');
    Route::post(
        '/tenant/tenancies/{tenancy}/contracts/{contract}/decline',
        [TenantTenanciesController::class, 'declineContract'],
    )->name('tenant.tenancies.contracts.decline');
    Route::prefix('tenant/rental-requests')->name('tenant.rental-requests.')->group(function (): void {
        Route::get('/', [TenantRentalRequestsController::class, 'index'])->name('index');
        Route::post('/', [TenantRentalRequestsController::class, 'store'])->name('store');
        Route::get('/{rentalRequest}', [TenantRentalRequestsController::class, 'show'])->whereUuid('rentalRequest')->name('show');
        Route::post('/{rentalRequest}/withdraw', [TenantRentalRequestsController::class, 'withdraw'])->whereUuid('rentalRequest')->name('withdraw');
    });
});
