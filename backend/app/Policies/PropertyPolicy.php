<?php

namespace App\Policies;

use App\Models\Property;
use App\Models\User;

class PropertyPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canManageOwnerProducts();
    }

    public function create(User $user): bool
    {
        return $user->canManageOwnerProducts();
    }

    public function view(User $user, Property $property): bool
    {
        return $this->ownsActiveAccount($user, $property);
    }

    public function update(User $user, Property $property): bool
    {
        return $this->ownsActiveAccount($user, $property);
    }

    public function archive(User $user, Property $property): bool
    {
        return $this->ownsActiveAccount($user, $property);
    }

    private function ownsActiveAccount(User $user, Property $property): bool
    {
        return $user->canManageOwnerProducts()
            && $user->id === $property->owner_id;
    }
}
