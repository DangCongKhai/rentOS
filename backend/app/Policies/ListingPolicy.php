<?php

namespace App\Policies;

use App\Models\User;

class ListingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin()
            && $user->account_status === 'ACTIVE'
            && $user->hasVerifiedEmail();
    }

    public function review(User $user): bool
    {
        return $this->viewAny($user);
    }
}
