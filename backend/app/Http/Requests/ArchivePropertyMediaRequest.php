<?php

namespace App\Http\Requests;

use App\Models\Property;

class ArchivePropertyMediaRequest extends OwnerProductRequest
{
    public function authorize(): bool
    {
        $property = $this->route('property');

        return parent::authorize()
            && $property instanceof Property
            && $this->user()->can('update', $property);
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'revision' => ['required', 'integer', 'min:1'],
        ];
    }
}
