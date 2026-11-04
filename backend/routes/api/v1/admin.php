<?php

use App\Http\Controllers\Api\V1\AdminDashboardController;
use App\Http\Controllers\Api\V1\AdminListingReviewMediaController;
use App\Http\Controllers\Api\V1\AdminListingReviewsController;
use App\Http\Controllers\Api\V1\AdminListingsController;
use App\Http\Middleware\EnsureAdminSession;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', EnsureAdminSession::class])->prefix('v1/admin')->name('api.v1.admin.')->group(function (): void {
    Route::get('/dashboard', AdminDashboardController::class)->name('dashboard');
    Route::get('/listing-reviews', [AdminListingReviewsController::class, 'index'])->name('listing-reviews.index');
    Route::get('/listing-reviews/{listing}', [AdminListingReviewsController::class, 'show'])->whereUuid('listing')->name('listing-reviews.show');
    Route::post('/listing-reviews/{listing}/approve', [AdminListingReviewsController::class, 'approve'])->whereUuid('listing')->name('listing-reviews.approve');
    Route::post('/listing-reviews/{listing}/reject', [AdminListingReviewsController::class, 'reject'])->whereUuid('listing')->name('listing-reviews.reject');
    Route::get('/listing-reviews/{listing}/media/{media}', AdminListingReviewMediaController::class)->whereUuid(['listing', 'media'])->name('listing-reviews.media');
    Route::get('/listings/pending', [AdminListingsController::class, 'pending'])->name('listings.pending');
    Route::post('/listings/{listing}/approve', [AdminListingsController::class, 'approve'])->name('listings.approve');
    Route::post('/listings/{listing}/reject', [AdminListingsController::class, 'reject'])->name('listings.reject');
});
