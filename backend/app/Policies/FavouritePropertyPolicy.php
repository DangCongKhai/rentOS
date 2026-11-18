<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

class FavouritePropertyPolicy
{
    public function read(User $user): bool
    {
        return $this->allows($user, 'favourites:read');
    }

    public function write(User $user): bool
    {
        return $user->account_status === 'ACTIVE'
            && $user->hasVerifiedEmail()
            && ! ($user->currentAccessToken() instanceof PersonalAccessToken)
            && Auth::guard('web')->id() === $user->id;
    }

    private function allows(User $user, string $ability): bool
    {
        return $user->account_status === 'ACTIVE'
            && $user->hasVerifiedEmail()
            && (! ($user->currentAccessToken() instanceof PersonalAccessToken) || $user->tokenCan($ability));
    }
}
