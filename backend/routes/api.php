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
require base_path('routes/api/v1/admin.php');
require base_path('routes/api/v1/tenant.php');

// Owner endpoints
require base_path('routes/api/v1/owner/properties.php');
require base_path('routes/api/v1/owner/listings.php');
require base_path('routes/api/v1/owner/amenities.php');
