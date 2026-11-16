<?php

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
| Route files are organized by domain and concern for clarity:
| - health.php: Health check endpoints
| - public.php: Public listings, amenities, locations
| - auth.php: Authenticated user endpoints
| - admin.php: Admin dashboard and reviews
| - tenant.php: Tenant tenancies
| - reports.php: Listing reports and suspension
| - owner/properties.php: Property and unit management
| - owner/listings.php: Listing creation and publishing
| - owner/amenities.php: Owner amenity catalog
|
*/

// Health check
require base_path('routes/api/v1/health.php');

// Public endpoints (no auth required)
require base_path('routes/api/v1/public.php');

// Authenticated endpoints
require base_path('routes/api/v1/auth.php');
require base_path('routes/api/v1/notifications.php');
require base_path('routes/api/v1/favourites.php');
require base_path('routes/api/v1/admin.php');
require base_path('routes/api/v1/tenant.php');
require base_path('routes/api/v1/reports.php');

// Owner endpoints
require base_path('routes/api/v1/owner/properties.php');
require base_path('routes/api/v1/owner/listings.php');
require base_path('routes/api/v1/owner/amenities.php');
require base_path('routes/api/v1/owner/rental-requests.php');
require base_path('routes/api/v1/owner/tenancies.php');

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/debug/db-performance', function () {
    $start = microtime(true);

    // Force Laravel to establish the PDO connection.
    DB::connection()->getPdo();

    $connectionMs = (microtime(true) - $start) * 1000;

    $queries = [];

    for ($i = 0; $i < 10; $i++) {
        $start = microtime(true);

        DB::select('SELECT 1');

        $queries[] = round(
            (microtime(true) - $start) * 1000,
            2
        );
    }

    return response()->json([
        'connection_ms' => round($connectionMs, 2),
        'queries_ms' => $queries,
    ]);
});
