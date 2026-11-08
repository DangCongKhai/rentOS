<?php

namespace App\Http\Requests;

class StoreTenancyProposalRequest extends OwnerProductRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return parent::authorize();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'unit_id' => ['required', 'uuid'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after:start_date'],
            'monthly_rent' => ['required', 'integer', 'min:1'],
            'deposit_amount' => ['required', 'integer', 'min:0'],
            'policies_snapshot' => ['required', 'array'],
            'agreement_document' => ['required', 'file', 'mimes:pdf', 'max:10240'],
            'signed_on' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
