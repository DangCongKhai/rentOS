<?php

use App\Http\Controllers\Api\V1\OwnerRentalRequestsController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1/owner/rental-requests')->name('api.v1.owner.rental-requests.')->group(function (): void {
    Route::get('/', [OwnerRentalRequestsController::class, 'index'])->name('index');
    Route::get('/{rentalRequest}', [OwnerRentalRequestsController::class, 'show'])->whereUuid('rentalRequest')->name('show');
    Route::post('/{rentalRequest}/reject', [OwnerRentalRequestsController::class, 'reject'])->whereUuid('rentalRequest')->name('reject');
});
