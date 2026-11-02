<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\OwnerProperties\AmenityCatalog;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerAmenityCatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        return response()->json([
            'data' => AmenityCatalog::search($validated['q'] ?? null),
        ])->header('Cache-Control', 'private, max-age=300');
    }
}
