<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePersonalAccessTokenRequest;
use App\Http\Resources\PersonalAccessTokenResource;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Laravel\Sanctum\PersonalAccessToken;

class PersonalAccessTokensController extends Controller
{
    public function index(): JsonResponse
    {
        $user = request()->user();

        abort_unless($user instanceof User && ! ($user->currentAccessToken() instanceof PersonalAccessToken), 403);

        return PersonalAccessTokenResource::collection($user->tokens()->latest('created_at')->get())
            ->toResponse(request())
            ->header('Cache-Control', 'private, no-store');
    }

    public function store(StorePersonalAccessTokenRequest $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $token = $user->createToken(
            $request->string('name')->trim()->toString(),
            $request->input('abilities'),
            $request->input('expires_at') === null
                ? null
                : CarbonImmutable::createFromFormat('!Y-m-d', $request->string('expires_at')->toString())->endOfDay(),
        );

        return response()->json([
            'message' => 'Personal access token created.',
            'data' => (new PersonalAccessTokenResource($token->accessToken))->resolve(),
            'plain_text_token' => $token->plainTextToken,
        ], 201)->header('Cache-Control', 'private, no-store');
    }

    public function destroy(string $tokenId): JsonResponse
    {
        $user = request()->user();
        abort_unless($user instanceof User && ! ($user->currentAccessToken() instanceof PersonalAccessToken), 403);

        $user->tokens()->whereKey($tokenId)->firstOrFail()->delete();

        return response()->json([], 204)->header('Cache-Control', 'private, no-store');
    }
}
