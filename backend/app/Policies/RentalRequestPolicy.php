<?php

namespace App\Policies;

use App\Models\RentalRequest;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

class RentalRequestPolicy
{
    public function viewAny(User $user): bool
    {
        if ($user->account_status !== 'ACTIVE' || ! $user->hasVerifiedEmail()) {
            return false;
        }

        if ($user->currentAccessToken() instanceof PersonalAccessToken) {
            return $user->tokenCan('rental-requests:read');
        }

        return Auth::guard('web')->id() === $user->id;
    }

    public function view(User $user, RentalRequest $rentalRequest): Response
    {
        if (! $this->viewAny($user)) {
            return Response::deny();
        }

        return $rentalRequest->tenant_id === $user->id ? Response::allow() : Response::denyAsNotFound();
    }

    public function withdraw(User $user, RentalRequest $rentalRequest): Response
    {
        if ($user->currentAccessToken() instanceof PersonalAccessToken) {
            return Response::deny();
        }

        return $this->view($user, $rentalRequest);
    }

    public function viewOwnerInbox(User $user): bool
    {
        return $user->canManageOwnerProducts()
            && ! ($user->currentAccessToken() instanceof PersonalAccessToken)
            && Auth::guard('web')->id() === $user->id;
    }

    public function reject(User $user, RentalRequest $rentalRequest): Response
    {
        if (! $this->viewOwnerInbox($user)) {
            return Response::deny();
        }

        return RentalRequest::query()->forOwner($user)->whereKey($rentalRequest->id)->exists()
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
