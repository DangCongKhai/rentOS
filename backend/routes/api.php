<?php

use App\Http\Controllers\Api\V1\AmenitiesController;
use App\Http\Controllers\Api\V1\CurrentUserController;
use App\Http\Controllers\Api\V1\OwnerPropertiesController;
use App\Http\Controllers\Api\V1\PublicListingsController;
use App\Http\Controllers\Api\V1\TenantTenanciesController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => 'rentOS',
    ]);
});

Route::prefix('v1')->group(function (): void {
    Route::get('/listings', [PublicListingsController::class, 'index'])->name('api.v1.listings.index');
    Route::get('/listings/{listing}', [PublicListingsController::class, 'show'])->name('api.v1.listings.show');
    Route::get('/amenities', [AmenitiesController::class, 'index'])->name('api.v1.amenities.index');
});

Route::middleware('auth:sanctum')->prefix('v1')->group(function (): void {
    Route::get('/me', [CurrentUserController::class, 'show'])->name('api.v1.me.show');
    Route::patch('/me', [CurrentUserController::class, 'update'])->name('api.v1.me.update');
    Route::get('/tenant/tenancies', [TenantTenanciesController::class, 'index'])->name('api.v1.tenant.tenancies');
    Route::get('/owner/properties', [OwnerPropertiesController::class, 'index'])->name('api.v1.owner.properties');
});
