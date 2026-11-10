<?php

namespace App\Http\Requests;

use App\Models\RentalRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class WithdrawRentalRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', RentalRequest::class);

        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($operationId = $this->input('client_operation_id'))) {
            $this->merge(['client_operation_id' => strtolower($operationId)]);
        }

        if (is_string($reason = $this->input('reason'))) {
            $reason = trim($reason);
            $this->merge(['reason' => $reason === '' ? null : $reason]);
        }
    }

    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'expected_updated_at' => ['required', 'date_format:Y-m-d\TH:i:s.uP'],
            'reason' => ['nullable', 'string', 'max:500', 'not_regex:/\x00/'],
        ];
    }
}
