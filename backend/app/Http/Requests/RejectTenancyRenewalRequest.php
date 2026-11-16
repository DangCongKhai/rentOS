<?php

namespace App\Http\Requests;

class RejectTenancyRenewalRequest extends OwnerProductRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($operationId = $this->input('client_operation_id'))) {
            $this->merge(['client_operation_id' => strtolower($operationId)]);
        }

        if (is_string($reason = $this->input('reason'))) {
            $this->merge(['reason' => trim($reason)]);
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'reason' => ['required', 'string', 'min:5', 'max:2000', 'not_regex:/\A\s*\z/u'],
            'tenancy_id' => ['prohibited'],
            'renewal_request_id' => ['prohibited'],
            'status' => ['prohibited'],
            'reviewed_by' => ['prohibited'],
            'reviewed_at' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Vui lòng nhập lý do từ chối đề nghị gia hạn.',
            'reason.min' => 'Lý do từ chối phải có ít nhất 5 ký tự.',
            'reason.max' => 'Lý do từ chối không được vượt quá 2.000 ký tự.',
            'reason.not_regex' => 'Vui lòng nhập lý do từ chối hợp lệ.',
        ];
    }
}
