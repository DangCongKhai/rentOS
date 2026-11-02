<?php

namespace App\Http\Requests;

use App\Models\Property;

class StoreListingRequest extends OwnerProductRequest
{
    public function authorize(): bool
    {
        $property = $this->route('property');

        return parent::authorize() && $property instanceof Property && $this->user()->can('update', $property);
    }

    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'title' => ['required', 'string', 'min:5', 'max:160'],
            'description' => ['required', 'string', 'min:20', 'max:10000'],
            'cover_media_id' => ['nullable', 'uuid'],
        ];
    }
}
