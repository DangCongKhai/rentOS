<?php

namespace App\Http\Requests\Api\V1;

use App\Domain\Amenities\AmenityCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PublicListingIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'location' => ['nullable', 'string', 'max:200'],
            'move_in_date' => ['nullable', 'date_format:Y-m-d'],
            'min_rent' => ['nullable', 'integer', 'min:0'],
            'max_rent' => ['nullable', 'integer', 'min:0'],
            'unit_kind' => ['nullable', 'string', Rule::in(['ROOM', 'STUDIO', 'APARTMENT', 'HOUSE'])],
            'bedrooms' => ['nullable', 'integer', 'min:0'],
            'bathrooms' => ['nullable', 'integer', 'min:0'],
            'occupants' => ['nullable', 'integer', 'min:1'],
            'amenities' => ['nullable', 'array'],
            'amenities.*' => ['string', Rule::in(array_keys(AmenityCatalog::KEYS))],
            'pets' => ['nullable', 'string', Rule::in(['ALLOWED', 'ASK_OWNER', 'NOT_ALLOWED'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }
}
