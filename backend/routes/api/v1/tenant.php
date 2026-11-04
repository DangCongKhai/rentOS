<?php

use App\Http\Controllers\Api\V1\TenantTenanciesController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.')->group(function (): void {
    Route::get('/tenant/tenancies', [TenantTenanciesController::class, 'index'])->name('tenant.tenancies');
});
