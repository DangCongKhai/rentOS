<?php

namespace App\Http\Requests;

use App\Actions\OwnerProperties\AmenityCatalog;
use App\Actions\OwnerProperties\PropertyPolicySchema;
use App\Models\Property;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreUnitsBatchRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $units = $this->input('units');

        if (! is_array($units)) {
            return;
        }

        foreach ($units as $index => $unit) {
            if (is_array($unit)) {
                $units[$index] = AmenityCatalog::normalizeUnitInput($unit);
            }
        }

        $this->merge(['units' => $units]);
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
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'client_operation_id' => ['required', 'uuid'],
            'units' => ['required', 'array', 'min:1', 'max:50'],
            'units.*' => ['required', 'array'],
            'units.*.client_operation_id' => ['required', 'uuid'],
            'units.*.label' => ['required', 'string', 'max:120'],
            'units.*.unit_kind' => ['required', Rule::in(['ROOM', 'STUDIO', 'APARTMENT', 'HOUSE'])],
            'units.*.description' => ['nullable', 'string', 'max:5000'],
            'units.*.floor' => ['nullable', 'string', 'max:100'],
            'units.*.area_m2' => ['nullable', 'numeric', 'gt:0'],
            'units.*.bedrooms' => ['required', 'integer', 'min:0'],
            'units.*.bathrooms' => ['required', 'numeric', 'min:0'],
            'units.*.bathroom_arrangement' => ['required', Rule::in(['PRIVATE', 'SHARED'])],
            'units.*.advertised_monthly_rent' => ['nullable', 'integer', 'gt:0'],
            'units.*.deposit' => ['nullable', 'integer', 'min:0'],
            'units.*.minimum_rental_months' => ['required', 'integer', 'min:3'],
            'units.*.max_occupants' => ['nullable', 'integer', 'min:1'],
            'units.*.operational_status' => ['sometimes', Rule::in(['READY', 'MAINTENANCE', 'RETIRED'])],
            'units.*.is_marketed' => ['prohibited'],
            'units.*.amenities' => ['sometimes', 'array:schema_version,standard,custom'],
            'units.*.amenities.schema_version' => ['required_with:units.*.amenities', 'integer', Rule::in([1])],
            'units.*.amenities.standard' => ['present_with:units.*.amenities', 'array'],
            'units.*.amenities.standard.*' => ['array:enabled,details'],
            'units.*.amenities.standard.*.enabled' => ['required', 'boolean'],
            'units.*.amenities.standard.*.details' => ['sometimes', 'nullable', 'string', 'max:160'],
            'units.*.amenities.custom' => ['present_with:units.*.amenities', 'array', 'max:50'],
            'units.*.amenities.custom.*' => ['required', 'string', 'not_regex:/^\s*$/u', 'max:120'],
            'units.*.policy_overrides' => ['sometimes', 'array:pets,smoking,additional_rules'],
            'units.*.policy_overrides.pets' => ['sometimes', Rule::in(PropertyPolicySchema::pets())],
            'units.*.policy_overrides.smoking' => ['sometimes', Rule::in(PropertyPolicySchema::smoking())],
            'units.*.policy_overrides.additional_rules' => ['sometimes', 'array', 'max:20'],
            'units.*.policy_overrides.additional_rules.*' => ['required', 'string', 'not_regex:/^\s*$/u', 'max:200'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            foreach ($this->input('units', []) as $index => $unit) {
                if (is_array($unit)) {
                    AmenityCatalog::validateUnitInput($unit, "units.{$index}", $validator);
                }
            }

            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $property = $this->route('property');
            if (! $property instanceof Property) {
                return;
            }

            $seenLabels = [];
            $seenOperationIds = [];
            $isPreviouslySubmittedBatch = DB::table('idempotency_records')
                ->where('actor_id', $this->user()->id)
                ->where('action', 'unit.bulk.create')
                ->where('client_operation_id', $this->input('client_operation_id'))
                ->exists();

            foreach ($this->input('units', []) as $index => $unit) {
                $labelKey = mb_strtolower(trim($unit['label']));
                $operationId = strtolower($unit['client_operation_id']);

                if (isset($seenLabels[$labelKey])) {
                    $validator->errors()->add(
                        "units.{$index}.label",
                        'This label duplicates another unit in the batch.',
                    );
                }
                $seenLabels[$labelKey] = true;

                if (isset($seenOperationIds[$operationId])) {
                    $validator->errors()->add(
                        "units.{$index}.client_operation_id",
                        'This operation ID duplicates another unit in the batch.',
                    );
                }
                $seenOperationIds[$operationId] = true;

                $labelExists = ! $isPreviouslySubmittedBatch
                    && DB::table('units')
                        ->where('property_id', $property->id)
                        ->whereRaw('lower(btrim(label)) = lower(btrim(?))', [$unit['label']])
                        ->exists();

                if ($labelExists) {
                    $validator->errors()->add(
                        "units.{$index}.label",
                        'This label is already used by a unit on this property.',
                    );
                }
            }
        }];
    }
}
