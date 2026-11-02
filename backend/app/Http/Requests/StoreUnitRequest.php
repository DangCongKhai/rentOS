<?php

namespace App\Http\Requests;

use App\Actions\OwnerProperties\AmenityCatalog;
use App\Actions\OwnerProperties\PropertyPolicySchema;
use App\Models\Property;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreUnitRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(AmenityCatalog::normalizeUnitInput($this->all()));
    }

    public function authorize(): bool
    {
        $property = $this->route('property');

        return $property instanceof Property
            && $property->rental_arrangement === 'SEPARATE_UNITS'
            && $this->user()?->can('update', $property) === true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'client_operation_id' => ['required', 'uuid'],
            'label' => [
                'required', 'string', 'max:120',
                Rule::unique('units', 'label')
                    ->where('property_id', $this->route('property')?->id)
                    ->whereNull('archived_at'),
            ],
            'unit_kind' => ['required', Rule::in(['ROOM', 'STUDIO', 'APARTMENT', 'HOUSE'])],
            'description' => ['nullable', 'string', 'max:5000'],
            'floor' => ['nullable', 'string', 'max:100'],
            'area_m2' => ['nullable', 'numeric', 'gt:0'],
            'bedrooms' => ['required', 'integer', 'min:0'],
            'bathrooms' => ['required', 'numeric', 'min:0'],
            'bathroom_arrangement' => ['required', Rule::in(['PRIVATE', 'SHARED'])],
            'advertised_monthly_rent' => ['nullable', 'integer', 'gt:0'],
            'deposit' => ['nullable', 'integer', 'min:0'],
            'minimum_rental_months' => ['required', 'integer', 'min:3'],
            'max_occupants' => ['nullable', 'integer', 'min:1'],
            'operational_status' => ['sometimes', Rule::in(['READY', 'MAINTENANCE', 'RETIRED'])],
            'is_marketed' => ['sometimes', 'boolean'],
            'amenities' => ['sometimes', 'array:schema_version,standard,custom'],
            'amenities.schema_version' => ['required_with:amenities', 'integer', Rule::in([1])],
            'amenities.standard' => ['present_with:amenities', 'array'],
            'amenities.standard.*' => ['array:enabled,details'],
            'amenities.standard.*.enabled' => ['required', 'boolean'],
            'amenities.standard.*.details' => ['sometimes', 'nullable', 'string', 'max:160'],
            'amenities.custom' => ['present_with:amenities', 'array', 'max:50'],
            'amenities.custom.*' => ['required', 'string', 'not_regex:/^\s*$/u', 'max:120'],
            'policy_overrides' => ['sometimes', 'array:pets,smoking,additional_rules'],
            'policy_overrides.pets' => ['sometimes', Rule::in(PropertyPolicySchema::pets())],
            'policy_overrides.smoking' => ['sometimes', Rule::in(PropertyPolicySchema::smoking())],
            'policy_overrides.additional_rules' => ['sometimes', 'array', 'max:20'],
            'policy_overrides.additional_rules.*' => ['required', 'string', 'not_regex:/^\s*$/u', 'max:200'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            AmenityCatalog::validateUnitInput($this->all(), '', $validator);
        }];
    }
}
