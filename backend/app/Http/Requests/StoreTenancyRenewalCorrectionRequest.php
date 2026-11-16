<?php

namespace App\Http\Requests;

class StoreTenancyRenewalCorrectionRequest extends OwnerProductRequest
{
    protected function prepareForValidation(): void
    {
        $snapshot = $this->input('policies_snapshot');

        if (! is_string($snapshot)) {
            return;
        }

        try {
            $decoded = json_decode($snapshot, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return;
        }

        if (is_array($decoded)) {
            $this->merge(['policies_snapshot' => $decoded]);
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'supersedes_contract_id' => ['required', 'uuid'],
            'end_date' => ['required', 'date_format:Y-m-d'],
            'monthly_rent' => ['required', 'integer', 'min:1'],
            'deposit_amount' => ['required', 'integer', 'min:0'],
            'policies_snapshot' => ['required', 'array'],
            'start_date' => ['prohibited'],
            'tenancy_id' => ['prohibited'],
            'renewal_request_id' => ['prohibited'],
            'type' => ['prohibited'],
            'status' => ['prohibited'],
            'owner_confirmed_at' => ['prohibited'],
            'tenant_confirmed_at' => ['prohibited'],
            'agreement_document' => ['prohibited'],
            'document_path' => ['prohibited'],
            'signed_on' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'supersedes_contract_id.required' => 'Thiếu phiên bản gia hạn cần điều chỉnh.',
            'supersedes_contract_id.uuid' => 'Phiên bản gia hạn cần điều chỉnh không hợp lệ.',
            'end_date.required' => 'Vui lòng chọn ngày kết thúc gia hạn.',
            'end_date.date_format' => 'Ngày kết thúc gia hạn không hợp lệ.',
            'monthly_rent.required' => 'Vui lòng nhập giá thuê tháng.',
            'monthly_rent.integer' => 'Giá thuê tháng phải là số nguyên.',
            'monthly_rent.min' => 'Giá thuê tháng phải lớn hơn 0.',
            'deposit_amount.integer' => 'Tiền đặt cọc phải là số nguyên.',
            'deposit_amount.min' => 'Tiền đặt cọc không được âm.',
            'policies_snapshot.required' => 'Vui lòng cung cấp chính sách áp dụng cho kỳ gia hạn.',
            'policies_snapshot.array' => 'Thông tin chính sách không hợp lệ.',
            'start_date.prohibited' => 'Ngày bắt đầu gia hạn được xác định từ kỳ thuê hiện tại.',
        ];
    }
}
