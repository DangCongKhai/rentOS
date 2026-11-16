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

    protected function prepareForValidation(): void
    {
        if (! $this->exists('audience')) {
            return;
        }

        $audience = $this->input('audience');
        if (is_string($audience)) {
            $this->merge(['audience' => [$audience]]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'audience' => ['sometimes', 'array', 'min:1'],
            'audience.*' => ['string', Rule::in(['ADMIN', 'TENANT', 'OWNER'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * @return list<string>
     */
    public function audiences(): array
    {
        $audience = $this->validated('audience');
        if (! is_array($audience)) {
            return ['OWNER', 'TENANT'];
        }

        $audiences = [];
        foreach ($audience as $value) {
            if (is_string($value) && ! in_array($value, $audiences, true)) {
                $audiences[] = $value;
            }
        }

        return $audiences === [] ? ['OWNER', 'TENANT'] : $audiences;
    }
}
