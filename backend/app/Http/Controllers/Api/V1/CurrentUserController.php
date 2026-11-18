<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateCurrentUserRequest;
use App\Http\Resources\CurrentUserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Laravel\Sanctum\PersonalAccessToken;

class CurrentUserController extends Controller
{
    public function show(Request $request): CurrentUserResource
    {
        $user = $request->user();
        $token = $user->currentAccessToken();
        $canRead = ! ($token instanceof PersonalAccessToken) || $user->tokenCan('account:read');

        abort_unless($user->account_status === 'ACTIVE' && $canRead, 403);

        return new CurrentUserResource($user);
    }

    public function update(UpdateCurrentUserRequest $request): JsonResource
    {
        $request->user()->fill($request->safe()->only(['name', 'phone']))->save();

        return new CurrentUserResource($request->user()->refresh());
    }
}
