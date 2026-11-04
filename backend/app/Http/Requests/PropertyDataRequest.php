<?php

namespace App\Http\Requests;

use App\Actions\OwnerProperties\AmenityCatalog;
use App\Models\Property;
use Illuminate\Validation\Validator;

abstract class PropertyDataRequest extends OwnerProductRequest
{
    protected function prepareForValidation(): void
    {
        $normalized = [];
        $amenities = $this->input('shared_amenities');
        $policies = $this->input('policies');

        if (is_array($amenities)) {
            $normalized['shared_amenities'] = AmenityCatalog::normalizeDocument($amenities);
        }

        $unitAmenities = $this->input('unit_amenities');
        if (is_array($unitAmenities)) {
            $normalized['unit_amenities'] = AmenityCatalog::normalizeDocument($unitAmenities);
        }

        if (is_array($policies) && is_array($policies['shared_rules'] ?? null)) {
            $policies['shared_rules'] = AmenityCatalog::normalizeRules($policies['shared_rules']);
            $normalized['policies'] = $policies;
        }

        if ($normalized !== []) {
            $this->merge($normalized);
        }
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $amenities = $this->input('shared_amenities');
            if (is_array($amenities)) {
                AmenityCatalog::validateDocument($amenities, 'shared', 'shared_amenities', $validator);
            }

            $rules = $this->input('policies.shared_rules');
            if (is_array($rules)) {
                AmenityCatalog::validatePlainRules($rules, 'policies.shared_rules', $validator);
            }

            $unitAmenities = $this->input('unit_amenities');
            if (is_array($unitAmenities)) {
                AmenityCatalog::validateDocument($unitAmenities, 'unit', 'unit_amenities', $validator);
            }

            if ($this->wholeSpaceFieldsPresent() && ! $this->isWholeSpaceRequest()) {
                foreach ($this->wholeSpaceFieldNames() as $field) {
                    if ($this->exists($field)) {
                        $validator->errors()->add($field, 'Trường này chỉ dùng cho hình thức cho thuê toàn bộ không gian.');
                    }
                }
            }
        });
    }

    /**
     * @return array<string, array<int, string>>
     */
    protected function propertyRules(bool $partial): array
    {
        $name = $partial
            ? ['sometimes', 'required', 'string', 'not_regex:/^\s*$/u', 'max:255']
            : ['required', 'string', 'not_regex:/^\s*$/u', 'max:255'];
        $propertyType = $partial
            ? ['sometimes', 'required', 'in:HOUSE,APARTMENT,APARTMENT_BUILDING']
            : ['required', 'in:HOUSE,APARTMENT,APARTMENT_BUILDING'];
        $rentalArrangement = $partial
            ? ['sometimes', 'required', 'in:WHOLE_SPACE,SEPARATE_UNITS']
            : ['required', 'in:WHOLE_SPACE,SEPARATE_UNITS'];

        return [
            'name' => $name,
            'property_type' => $propertyType,
            'rental_arrangement' => $rentalArrangement,
            'address_line' => ['sometimes', 'nullable', 'string', 'max:500'],
            'ward' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'shared_amenities' => ['sometimes', 'array:schema_version,standard,custom'],
            'shared_amenities.schema_version' => ['required_with:shared_amenities', 'integer', 'in:1'],
            'shared_amenities.standard' => ['present_with:shared_amenities', 'array'],
            'shared_amenities.standard.*' => ['array:enabled,details'],
            'shared_amenities.standard.*.enabled' => ['required', 'boolean'],
            'shared_amenities.standard.*.details' => ['sometimes', 'nullable', 'string', 'max:160'],
            'shared_amenities.custom' => ['present_with:shared_amenities', 'array', 'max:30'],
            'shared_amenities.custom.*' => ['required', 'string', 'not_regex:/^\s*$/u', 'max:160'],
            'policies' => ['sometimes', 'array:schema_version,pets,smoking,shared_rules'],
            'policies.schema_version' => ['required_with:policies', 'integer', 'in:1'],
            'policies.pets' => ['required_with:policies', 'in:NOT_ALLOWED,WITH_APPROVAL,ALLOWED'],
            'policies.smoking' => ['required_with:policies', 'in:NOT_ALLOWED,OUTDOOR_ONLY,ALLOWED'],
            'policies.shared_rules' => ['present_with:policies', 'array', 'max:20'],
            'policies.shared_rules.*' => ['required', 'string', 'not_regex:/^\s*$/u', 'max:200'],
            'owner_id' => ['prohibited'],
            'id' => ['prohibited'],
            'district' => ['prohibited'],
            'content_revision' => ['prohibited'],
            'archived_at' => ['prohibited'],
            'moderation_status' => ['prohibited'],
            'publication_status' => ['prohibited'],
            'is_admin' => ['prohibited'],
            'unit_amenities' => ['sometimes', 'array:schema_version,standard,custom'],
            'unit_amenities.schema_version' => ['required_with:unit_amenities', 'integer', 'in:1'],
            'unit_amenities.standard' => ['present_with:unit_amenities', 'array'],
            'unit_amenities.standard.*' => ['array:enabled,details'],
            'unit_amenities.standard.*.enabled' => ['required', 'boolean'],
            'unit_amenities.standard.*.details' => ['sometimes', 'nullable', 'string', 'max:160'],
            'unit_amenities.custom' => ['present_with:unit_amenities', 'array', 'max:30'],
            'unit_amenities.custom.*' => ['required', 'string', 'not_regex:/^\s*$/u', 'max:160'],
            'unit_description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'area_m2' => ['sometimes', 'nullable', 'numeric', 'min:0.1'],
            'bedrooms' => ['sometimes', 'integer', 'min:0'],
            'bathrooms' => ['sometimes', 'integer', 'min:0'],
            'advertised_monthly_rent' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'deposit' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'minimum_rental_months' => ['sometimes', 'integer', 'min:3'],
            'max_occupants' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    private function isWholeSpaceRequest(): bool
    {
        $arrangement = $this->input('rental_arrangement');
        if (! is_string($arrangement)) {
            $property = $this->route('property');
            $arrangement = $property instanceof Property ? $property->rental_arrangement : null;
        }

        return $arrangement === 'WHOLE_SPACE';
    }

    private function wholeSpaceFieldsPresent(): bool
    {
        foreach ($this->wholeSpaceFieldNames() as $field) {
            if ($this->exists($field)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function wholeSpaceFieldNames(): array
    {
        return [
            'unit_amenities',
            'unit_description',
            'area_m2',
            'bedrooms',
            'bathrooms',
            'advertised_monthly_rent',
            'deposit',
            'minimum_rental_months',
            'max_occupants',
        ];
    }
}
