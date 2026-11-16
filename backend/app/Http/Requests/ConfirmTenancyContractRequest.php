<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Laravel\Sanctum\PersonalAccessToken;

class ConfirmTenancyContractRequest extends FormRequest
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
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'client_operation_id.required' => 'Thiếu mã thao tác xác nhận.',
            'client_operation_id.uuid' => 'Mã thao tác xác nhận không hợp lệ.',
        ];
    }
}
