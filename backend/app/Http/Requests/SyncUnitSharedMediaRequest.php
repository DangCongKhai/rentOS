<?php

namespace App\Http\Requests;

use App\Models\Property;
use App\Models\Unit;

class SyncUnitSharedMediaRequest extends OwnerProductRequest
{
    public function authorize(): bool
    {
        $property = $this->route('property');
        $unit = $this->route('unit');

        return parent::authorize()
            && $property instanceof Property
            && $unit instanceof Unit
            && $unit->property_id === $property->id
            && $this->user()->can('update', $property);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'media_ids' => ['present', 'array', 'max:40'],
            'media_ids.*' => ['required', 'uuid', 'distinct:strict'],
        ];
    }
}
