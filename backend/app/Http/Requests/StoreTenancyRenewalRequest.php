<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

class StoreTenancyRenewalRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && $user->account_status === 'ACTIVE'
            && ! ($user->currentAccessToken() instanceof PersonalAccessToken)
            && Auth::guard('web')->id() === $user->id;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($operationId = $this->input('client_operation_id'))) {
            $this->merge(['client_operation_id' => strtolower($operationId)]);
        }

        if (is_string($message = $this->input('message'))) {
            $this->merge(['message' => trim($message)]);
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'requested_end_date' => ['required', 'date_format:Y-m-d'],
            'proposed_monthly_rent' => ['required', 'integer', 'min:1'],
            'message' => ['nullable', 'string', 'max:2000', 'not_regex:/\x00/'],
            'tenancy_id' => ['prohibited'],
            'tenant_id' => ['prohibited'],
            'status' => ['prohibited'],
            'reviewed_by' => ['prohibited'],
            'review_reason' => ['prohibited'],
            'revision' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'requested_end_date.required' => 'Chọn ngày kết thúc gia hạn đề xuất.',
            'requested_end_date.date_format' => 'Ngày kết thúc gia hạn không hợp lệ.',
            'proposed_monthly_rent.required' => 'Nhập giá thuê tháng đề xuất.',
            'proposed_monthly_rent.integer' => 'Giá thuê tháng phải là số nguyên.',
            'proposed_monthly_rent.min' => 'Giá thuê tháng phải lớn hơn 0.',
            'message.max' => 'Lời nhắn không được vượt quá 2.000 ký tự.',
        ];
    }
}
