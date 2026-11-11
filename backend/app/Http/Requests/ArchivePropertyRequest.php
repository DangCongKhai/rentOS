<?php

namespace App\Http\Requests;

use App\Models\Property;

class ArchivePropertyRequest extends OwnerProductRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'owner_id' => ['prohibited'],
            'archived_at' => ['prohibited'],
        ];
    }

    public function authorize(): bool
    {
        $property = $this->route('property');

        return parent::authorize()
            && $property instanceof Property
            && $this->user()->can('archive', $property);
    }
}
