<?php

namespace App\Http\Requests;

use App\Models\Property;
use App\Models\Unit;
use Illuminate\Validation\Validator;

class StorePropertyMediaRequest extends OwnerProductRequest
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
            'client_operation_id' => ['required', 'uuid'],
            'expected_content_revision' => ['required', 'integer', 'min:1'],
            'unit_id' => ['nullable', 'uuid'],
            'caption' => ['nullable', 'string', 'max:500'],
            'photo' => [
                'required',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:'.config(
                    'services.supabase.storage.max_file_size_kilobytes',
                    10240,
                ),
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $property = $this->route('property');
                $unitId = $this->input('unit_id');

                if (! $property instanceof Property) {
                    return;
                }

                if ($unitId !== null) {
                    $unit = Unit::query()->find($unitId);

                    if (
                        $unit === null
                        || $unit->property_id !== $property->id
                        || $unit->archived_at !== null
                    ) {
                        $validator->errors()->add(
                            'unit_id',
                            'Choose an active unit belonging to this property.',
                        );
                    }
                }

                $photo = $this->file('photo');
                $image = $photo ? @getimagesize($photo->getRealPath()) : false;

                if (
                    ! is_array($image)
                    || ! in_array($image['mime'], [
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                    ], true)
                ) {
                    $validator->errors()->add(
                        'photo',
                        'Upload a valid JPEG, PNG, or WebP image.',
                    );
                }
            },
        ];
    }
}
