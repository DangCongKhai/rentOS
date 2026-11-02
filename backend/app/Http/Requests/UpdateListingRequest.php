<?php

namespace App\Http\Requests;

use App\Models\Property;

class UpdateListingRequest extends OwnerProductRequest
{
    public function authorize(): bool
    {
        $property = $this->route('property');

        return parent::authorize() && $property instanceof Property && $this->user()->can('update', $property);
    }

    public function rules(): array
    {
        return [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'title' => ['sometimes', 'required', 'string', 'min:5', 'max:160'],
            'description' => ['sometimes', 'required', 'string', 'min:20', 'max:10000'],
            'cover_media_id' => ['sometimes', 'nullable', 'uuid'],
        ];
    }
}
