<?php

use App\Http\Controllers\Api\V1\AdminListingReportsController;
use App\Http\Controllers\Api\V1\AdminListingSuspensionController;
use App\Http\Controllers\Api\V1\ListingReportsController;
use App\Http\Controllers\Api\V1\TenantReportsController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1')->name('api.v1.')->group(function (): void {
    // Listing Reports (Reporter Flow)
    Route::post('/listings/{listing}/reports', [ListingReportsController::class, 'store'])
        ->middleware('throttle:10,1')
        ->name('listings.reports.store');
    Route::get('/tenant/reports', [TenantReportsController::class, 'index'])->name('tenant.reports.index');
    Route::get('/tenant/reports/{report}', [TenantReportsController::class, 'show'])->name('tenant.reports.show');

    // Admin Listing Reports & Investigation Flow
    Route::get('/admin/listing-reports', [AdminListingReportsController::class, 'index'])->name('admin.listing-reports.index');
    Route::get('/admin/listing-reports/{report}', [AdminListingReportsController::class, 'show'])->name('admin.listing-reports.show');
    Route::post('/admin/listing-reports/{report}/start-review', [AdminListingReportsController::class, 'startReview'])->name('admin.listing-reports.start-review');
    Route::post('/admin/listing-reports/{report}/resolve', [AdminListingReportsController::class, 'resolve'])->name('admin.listing-reports.resolve');
    Route::post('/admin/listing-reports/{report}/dismiss', [AdminListingReportsController::class, 'dismiss'])->name('admin.listing-reports.dismiss');

    // Admin Listing Direct Suspension & Restoration
    Route::post('/admin/listings/{listing}/suspend', [AdminListingSuspensionController::class, 'suspend'])->name('admin.listings.suspend');
    Route::post('/admin/listings/{listing}/restore', [AdminListingSuspensionController::class, 'restore'])->name('admin.listings.restore');
});
