<?php

use App\Http\Controllers\Api\V1\AdminDashboardController;
use App\Http\Controllers\Api\V1\AdminListingReviewMediaController;
use App\Http\Controllers\Api\V1\AdminListingReviewsController;
use App\Http\Controllers\Api\V1\AmenitiesController;
use App\Http\Controllers\Api\V1\CurrentUserController;
use App\Http\Controllers\Api\V1\OwnerPropertiesController;
use App\Http\Controllers\Api\V1\PublicListingsController;
use App\Http\Controllers\Api\V1\TenantTenanciesController;
use App\Http\Middleware\EnsureAdminSession;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => 'rentOS',
    ]);
});

Route::middleware(['auth:sanctum', EnsureAdminSession::class])->prefix('v1/admin')->name('api.v1.admin.')->group(function (): void {
    Route::get('/dashboard', AdminDashboardController::class)->name('dashboard');
    Route::get('/listing-reviews', [AdminListingReviewsController::class, 'index'])->name('listing-reviews.index');
    Route::get('/listing-reviews/{listing}', [AdminListingReviewsController::class, 'show'])->whereUuid('listing')->name('listing-reviews.show');
    Route::post('/listing-reviews/{listing}/approve', [AdminListingReviewsController::class, 'approve'])->whereUuid('listing')->name('listing-reviews.approve');
    Route::post('/listing-reviews/{listing}/reject', [AdminListingReviewsController::class, 'reject'])->whereUuid('listing')->name('listing-reviews.reject');
    Route::get('/listing-reviews/{listing}/media/{media}', AdminListingReviewMediaController::class)->whereUuid(['listing', 'media'])->name('listing-reviews.media');
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
