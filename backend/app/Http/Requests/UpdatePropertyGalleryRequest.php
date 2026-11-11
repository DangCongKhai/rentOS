<?php

namespace App\Http\Requests;

use App\Models\Property;

class UpdatePropertyGalleryRequest extends OwnerProductRequest
{
    public function authorize(): bool
    {
        $property = $this->route('property');

        return parent::authorize()
            && $property instanceof Property
            && $this->user()->can('update', $property);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'items' => ['required', 'array', 'max:20'],
            'items.*' => [
                'required',
                'array:media_id,revision,sort_order,is_selected_for_listing',
            ],
            'items.*.media_id' => ['required', 'uuid', 'distinct:strict'],
            'items.*.revision' => ['required', 'integer', 'min:1'],
            'items.*.sort_order' => ['required', 'integer', 'min:0', 'distinct:strict'],
            'items.*.is_selected_for_listing' => ['required', 'boolean'],
        ];
    }
}
