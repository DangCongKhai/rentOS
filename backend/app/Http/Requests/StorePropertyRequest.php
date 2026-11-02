<?php

namespace App\Http\Requests;

use App\Models\Property;

class StorePropertyRequest extends PropertyDataRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return $this->propertyRules(partial: false) + [
            'client_operation_id' => ['required', 'uuid'],
        ];
    }

    public function authorize(): bool
    {
        return parent::authorize()
            && $this->user()->can('create', Property::class);
    }
}
