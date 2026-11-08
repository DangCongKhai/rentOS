<?php

namespace App\Http\Requests;

class CloseTenancyRequest extends OwnerProductRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'reason' => [
                'required',
                'string',
                'min:5',
                'max:2000',
                'not_regex:/\A\s*\z/u',
            ],
        ];
    }
}