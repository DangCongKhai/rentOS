<?php

use App\Http\Controllers\Api\V1\OwnerListingsController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.owner.')->group(function (): void {
    Route::get('/owner/listings/{listing}', [OwnerListingsController::class, 'showOwned'])->name('listings.show');
    Route::get('/owner/properties/{property}/listing', [OwnerListingsController::class, 'show'])->name('properties.listing.show');
    Route::post('/owner/properties/{property}/listing', [OwnerListingsController::class, 'store'])->name('properties.listing.store');
    Route::patch('/owner/properties/{property}/listing', [OwnerListingsController::class, 'update'])->name('properties.listing.update');
    Route::post('/owner/properties/{property}/listing/submit', [OwnerListingsController::class, 'submit'])->name('properties.listing.submit');
    Route::post('/owner/properties/{property}/listing/publish', [OwnerListingsController::class, 'publish'])->name('properties.listing.publish');
    Route::post('/owner/properties/{property}/listing/hide', [OwnerListingsController::class, 'hide'])->name('properties.listing.hide');
    Route::post('/owner/properties/{property}/listing/archive', [OwnerListingsController::class, 'archive'])->name('properties.listing.archive');
});
