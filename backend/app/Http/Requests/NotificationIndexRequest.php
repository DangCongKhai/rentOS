<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class NotificationIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'audience' => ['required', 'string', Rule::in(['ADMIN', 'TENANT', 'OWNER'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
