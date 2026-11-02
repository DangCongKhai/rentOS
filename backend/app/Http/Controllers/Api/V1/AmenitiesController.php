<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Amenities\AmenityCatalog;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class AmenitiesController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => AmenityCatalog::publicCatalog(),
        ]);
    }
}
