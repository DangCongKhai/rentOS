<?php

use App\Http\Controllers\Api\V1\CurrentUserController;
use App\Http\Controllers\Api\V1\PersonalAccessTokensController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.')->group(function (): void {
    Route::get('/me', [CurrentUserController::class, 'show'])->name('me.show');
    Route::patch('/me', [CurrentUserController::class, 'update'])->name('me.update');
    Route::get('/personal-access-tokens', [PersonalAccessTokensController::class, 'index'])->name('tokens.index');
    Route::post('/personal-access-tokens', [PersonalAccessTokensController::class, 'store'])->name('tokens.store');
    Route::delete('/personal-access-tokens/{tokenId}', [PersonalAccessTokensController::class, 'destroy'])->whereNumber('tokenId')->name('tokens.destroy');
});
