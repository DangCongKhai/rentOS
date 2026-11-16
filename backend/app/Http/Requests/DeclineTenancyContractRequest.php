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
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'client_operation_id.required' => 'Thiếu mã thao tác từ chối.',
            'client_operation_id.uuid' => 'Mã thao tác từ chối không hợp lệ.',
            'reason.required' => 'Vui lòng nhập lý do từ chối.',
            'reason.min' => 'Lý do từ chối cần có ít nhất 5 ký tự.',
            'reason.max' => 'Lý do từ chối không được vượt quá 2.000 ký tự.',
        ];
    }
}
