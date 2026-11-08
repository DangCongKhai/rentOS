<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Laravel\Sanctum\PersonalAccessToken;

class DeclineTenancyContractRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && $user->account_status === 'ACTIVE'
            && ! ($user->currentAccessToken() instanceof PersonalAccessToken);
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'document_sha256' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ];
    }
}
