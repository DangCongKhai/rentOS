<?php

use App\Http\Controllers\Api\V1\AmenitiesController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.owner.')->group(function (): void {
    Route::get('/owner/amenities', [AmenitiesController::class, 'ownerCatalog'])->name('amenities.index');
});
