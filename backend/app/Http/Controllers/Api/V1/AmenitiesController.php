<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\OwnerProperties\AmenityCatalog;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class AmenitiesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:80'],
        ])['q'] ?? null;

        if ($query !== null) {
            return response()->json([
                'data' => AmenityCatalog::search($query),
            ]);
        }

        return response()->json([
            'data' => AmenityCatalog::publicCatalog(),
        ]);
    }

    public function ownerCatalog(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->canManageOwnerProducts(), 403);
        abort_if($user->currentAccessToken() instanceof PersonalAccessToken, 403);

        $query = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:80'],
        ])['q'] ?? null;

        return response()->json([
            'data' => AmenityCatalog::search($query),
        ])->header('Cache-Control', 'private, no-store');
    }
}
