<?php

namespace App\Http\Requests;

use App\Models\Listing;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class AdminListingReviewDecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('review', Listing::class);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    public function rules(): array
    {
        return [
            'expected_snapshot' => ['required', 'string', 'regex:/\A[0-9a-f]{64}\z/'],
            'client_operation_id' => ['required', 'uuid'],
            'reason' => $this->routeIs('api.v1.admin.listing-reviews.reject') ? ['required', 'string', 'max:1000'] : ['prohibited'],
            'reviewed_by' => ['prohibited'],
            'reviewed_at' => ['prohibited'],
            'moderation_status' => ['prohibited'],
            'publication_status' => ['prohibited'],
            'is_admin' => ['prohibited'],
            'owner_id' => ['prohibited'],
            'approved_content_revision' => ['prohibited'],
            'current_snapshot' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Vui lòng nhập lý do từ chối.',
            'reason.max' => 'Lý do từ chối không được vượt quá 1.000 ký tự.',
            'expected_snapshot.required' => 'Vui lòng tải lại gói tin trước khi quyết định.',
        ];
    }
}
