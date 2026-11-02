<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Laravel\Sanctum\PersonalAccessToken;

abstract class OwnerProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && $user->canManageOwnerProducts()
            && ! ($user->currentAccessToken() instanceof PersonalAccessToken);
    }
}
