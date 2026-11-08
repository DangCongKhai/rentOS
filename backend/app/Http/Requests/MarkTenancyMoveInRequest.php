<?php

namespace App\Http\Requests;

class MarkTenancyMoveInRequest extends OwnerProductRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
        ];
    }
}
