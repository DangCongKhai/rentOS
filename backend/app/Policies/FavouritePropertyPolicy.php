<?php

namespace App\Policies;

use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;

class FavouritePropertyPolicy
{
    public function read(User $user): bool
    {
        return $this->allows($user, 'favourites:read');
    }

    public function write(User $user): bool
    {
        return $this->allows($user, 'favourites:write');
    }

    private function allows(User $user, string $ability): bool
    {
        return $user->account_status === 'ACTIVE'
            && $user->hasVerifiedEmail()
            && (! ($user->currentAccessToken() instanceof PersonalAccessToken) || $user->tokenCan($ability));
    }
}
