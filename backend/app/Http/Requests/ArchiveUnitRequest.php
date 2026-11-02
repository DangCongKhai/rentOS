<?php

namespace App\Http\Requests;

use App\Models\Property;
use App\Models\Unit;

class ArchiveUnitRequest extends OwnerProductRequest
{
    public function authorize(): bool
    {
        $property = $this->route('property');
        $unit = $this->route('unit');

        return parent::authorize()
            && $property instanceof Property
            && $unit instanceof Unit
            && $unit->property_id === $property->id
            && $property->rental_arrangement === 'SEPARATE_UNITS'
            && $this->user()->can('update', $property);
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'archived_at' => ['prohibited'],
            'owner_id' => ['prohibited'],
        ];
    }
}
