<?php

namespace App\Http\Requests;

class CorrectTenancyProposalRequest extends OwnerProductRequest
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
