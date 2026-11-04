<?php

use App\Http\Controllers\Api\V1\CurrentUserController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.')->group(function (): void {
    Route::get('/me', [CurrentUserController::class, 'show'])->name('me.show');
    Route::patch('/me', [CurrentUserController::class, 'update'])->name('me.update');
});
