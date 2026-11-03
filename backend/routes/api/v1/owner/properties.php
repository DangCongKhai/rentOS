<?php

use App\Http\Controllers\Api\V1\OwnerPropertiesController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.owner.')->group(function (): void {
    // Properties
    Route::get('/owner/properties', [OwnerPropertiesController::class, 'index'])->name('properties.index');
    Route::post('/owner/properties', [OwnerPropertiesController::class, 'store'])->name('properties.store');
    Route::get('/owner/properties/{property}', [OwnerPropertiesController::class, 'show'])->name('properties.show');
    Route::put('/owner/properties/{property}', [OwnerPropertiesController::class, 'update'])->name('properties.update');
    Route::patch('/owner/properties/{property}', [OwnerPropertiesController::class, 'update'])->name('properties.patch');
    Route::patch('/owner/properties/{property}/archive', [OwnerPropertiesController::class, 'archive'])->name('properties.archive');

    // Units
    Route::post('/owner/properties/{property}/units', [OwnerPropertiesController::class, 'storeUnit'])->name('properties.units.store');
    Route::patch('/owner/properties/{property}/units/{unit}', [OwnerPropertiesController::class, 'updateUnit'])->name('properties.units.update');
    Route::patch('/owner/properties/{property}/units/{unit}/archive', [OwnerPropertiesController::class, 'archiveUnit'])->name('properties.units.archive');
    Route::post('/owner/properties/{property}/units/bulk', [OwnerPropertiesController::class, 'storeUnitsBatch'])->name('properties.units.bulk');

    // Media
    Route::post('/owner/properties/{property}/media', [OwnerPropertiesController::class, 'storeMedia'])->name('properties.media.store');
    Route::get('/owner/properties/{property}/media', [OwnerPropertiesController::class, 'indexMedia'])->name('properties.media.index');
    Route::delete('/owner/properties/{property}/media/{media}', [OwnerPropertiesController::class, 'archiveMedia'])->name('properties.media.archive');

    // Gallery
    Route::put('/owner/properties/{property}/gallery', [OwnerPropertiesController::class, 'updateGallery'])->name('properties.gallery.update');
    Route::put('/owner/properties/{property}/units/{unit}/gallery', [OwnerPropertiesController::class, 'updateUnitGallery'])->name('properties.units.gallery.update');
    Route::put('/owner/properties/{property}/units/{unit}/shared-media', [OwnerPropertiesController::class, 'syncSharedMedia'])->name('properties.units.shared-media');
});
