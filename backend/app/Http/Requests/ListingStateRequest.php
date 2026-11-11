<?php

namespace App\Http\Requests;

use App\Models\Property;

class ListingStateRequest extends OwnerProductRequest
{
    public function authorize(): bool
    {
        $property = $this->route('property');

        return parent::authorize() && $property instanceof Property && $this->user()->can('update', $property);
    }

    public function rules(): array
    {
        return ['expected_content_revision' => ['required', 'integer', 'min:1']];
    }
}
