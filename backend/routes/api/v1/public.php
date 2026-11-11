<?php

use App\Http\Controllers\Api\V1\AmenitiesController;
use App\Http\Controllers\Api\V1\LocationsController;
use App\Http\Controllers\Api\V1\PublicListingsController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/listings', [PublicListingsController::class, 'index'])->name('api.v1.listings.index');
    Route::get('/listings/{listing}', [PublicListingsController::class, 'show'])->name('api.v1.listings.show');
    Route::get('/amenities', [AmenitiesController::class, 'index'])->name('api.v1.amenities.index');
    Route::get('/locations/provinces', [LocationsController::class, 'provinces'])->name('api.v1.locations.provinces');
    Route::get('/locations/provinces/{provinceCode}/wards', [LocationsController::class, 'wards'])->name('api.v1.locations.wards');
});
