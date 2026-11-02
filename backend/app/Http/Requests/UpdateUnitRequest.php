<?php

namespace App\Http\Requests;

use App\Actions\OwnerProperties\AmenityCatalog;
use App\Actions\OwnerProperties\PropertyPolicySchema;
use App\Models\Property;
use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateUnitRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(AmenityCatalog::normalizeUnitInput($this->all()));
    }

    public function authorize(): bool
    {
        $property = $this->route('property');
        $unit = $this->route('unit');

        return $property instanceof Property
            && $unit instanceof Unit
            && $unit->property_id === $property->id
            && $this->user()?->can('update', $property) === true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'client_operation_id' => ['prohibited'],

            'label' => ['sometimes', 'required', 'string', 'max:120'],
            'unit_kind' => ['sometimes', 'required', Rule::in([
                'ROOM', 'STUDIO', 'APARTMENT', 'HOUSE',
            ])],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'floor' => ['sometimes', 'nullable', 'string', 'max:100'],
            'area_m2' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'bedrooms' => ['sometimes', 'required', 'integer', 'min:0'],
            'bathrooms' => ['sometimes', 'required', 'numeric', 'min:0'],
            'bathroom_arrangement' => ['sometimes', 'required', Rule::in([
                'PRIVATE', 'SHARED',
            ])],
            'advertised_monthly_rent' => ['sometimes', 'nullable', 'integer', 'gt:0'],
            'deposit' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'minimum_rental_months' => ['sometimes', 'required', 'integer', 'min:3'],
            'max_occupants' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'operational_status' => ['sometimes', Rule::in([
                'READY', 'MAINTENANCE', 'RETIRED',
            ])],
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

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            AmenityCatalog::validateUnitInput($this->all(), '', $validator);
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $property = $this->route('property');
            $unit = $this->route('unit');

            if (! $property instanceof Property || ! $unit instanceof Unit) {
                return;
            }

            $label = $this->input('label');

            if (is_string($label) && DB::table('units')
                ->where('property_id', $property->id)
                ->where('id', '<>', $unit->id)
                ->whereRaw('lower(btrim(label)) = lower(btrim(?))', [$label])
                ->exists()) {
                $validator->errors()->add('label', 'This label is already used by another unit.');
            }

            $isMarketed = (bool) $this->input('is_marketed', $unit->is_marketed);
            if (! $isMarketed) {
                return;
            }

            $requiredWhenMarketed = [
                'description' => $this->input('description', $unit->description),
                'area_m2' => $this->input('area_m2', $unit->area_m2),
                'advertised_monthly_rent' => $this->input(
                    'advertised_monthly_rent',
                    $unit->advertised_monthly_rent,
                ),
                'deposit' => $this->input('deposit', $unit->deposit),
                'max_occupants' => $this->input('max_occupants', $unit->max_occupants),
            ];

            foreach ($requiredWhenMarketed as $field => $value) {
                if ($value === null || ($field === 'description' && trim((string) $value) === '')) {
                    $validator->errors()->add($field, match ($field) {
                        'description' => 'Nhập mô tả phòng trước khi chọn phòng này để đăng tin.',
                        'area_m2' => 'Nhập diện tích phòng trước khi chọn phòng này để đăng tin.',
                        'advertised_monthly_rent' => 'Nhập giá thuê tháng trước khi chọn phòng này để đăng tin.',
                        'deposit' => 'Nhập tiền đặt cọc trước khi chọn phòng này để đăng tin.',
                        'max_occupants' => 'Nhập số người tối đa trước khi chọn phòng này để đăng tin.',
                    });
                }
            }
        });
    }
}
