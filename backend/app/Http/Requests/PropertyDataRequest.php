<?php

namespace App\Http\Requests;

use App\Actions\OwnerProperties\AmenityCatalog;
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
        ];
    }
}
