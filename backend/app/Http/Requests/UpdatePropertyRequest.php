<?php

namespace App\Http\Requests;

use App\Models\Property;

class UpdatePropertyRequest extends PropertyDataRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return $this->propertyRules(partial: true) + [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'client_operation_id' => ['prohibited'],
        ];
    }

    public function authorize(): bool
    {
        $property = $this->route('property');

        return parent::authorize()
            && $property instanceof Property
            && $this->user()->can('update', $property);
    }
}
