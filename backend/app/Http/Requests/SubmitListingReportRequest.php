<?php

namespace App\Http\Requests;

use App\Models\ListingReport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubmitListingReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->account_status === 'ACTIVE';
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'reason_code' => [
                'required',
                'string',
                Rule::in([
                    ListingReport::REASON_FRAUD,
                    ListingReport::REASON_MISLEADING,
                    ListingReport::REASON_HARMFUL,
                    ListingReport::REASON_OTHER,
                ]),
            ],
            'description' => ['required', 'string', 'min:1', 'max:2000'],
            'client_operation_id' => ['nullable', 'uuid'],
        ];
    }
}
