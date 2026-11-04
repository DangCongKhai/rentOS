<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DismissListingReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->isAdmin();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'resolution_summary' => ['required', 'string', 'min:1', 'max:2000'],
            'internal_notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
