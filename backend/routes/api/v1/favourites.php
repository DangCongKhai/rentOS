<?php

use App\Http\Controllers\Api\V1\FavouritePropertiesController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1/favourite-properties')->name('api.v1.favourite-properties.')->group(function (): void {
    Route::get('/', [FavouritePropertiesController::class, 'index'])->name('index');
    Route::get('/ids', [FavouritePropertiesController::class, 'ids'])->name('ids');
    Route::get('/count', [FavouritePropertiesController::class, 'count'])->name('count');
    Route::put('/{property}', [FavouritePropertiesController::class, 'store'])->whereUuid('property')->name('store');
    Route::delete('/{property}', [FavouritePropertiesController::class, 'destroy'])->whereUuid('property')->name('destroy');
});
