<?php

namespace App\Actions\OwnerProperties;

use Illuminate\Validation\Validator;
use Normalizer;

class AmenityCatalog
{
    /**
     * @var array<string, array{label: string, label_vi: string, scopes: array<int, string>, aliases: array<int, string>}>
     */
    private const CATALOG = [
        'wifi' => [
            'label' => 'Wi-Fi',
            'label_vi' => 'Wifi',
            'scopes' => ['shared', 'unit'],
            'aliases' => ['wi-fi', 'wireless', 'internet'],
        ],
        'elevator' => [
            'label' => 'Thang máy',
            'label_vi' => 'Thang máy',
            'scopes' => ['shared'],
            'aliases' => ['lift'],
        ],
        'air_conditioning' => [
            'label' => 'Điều hòa',
            'label_vi' => 'Máy lạnh',
            'scopes' => ['unit'],
            'aliases' => ['aircon', 'air con', 'ac', 'máy lạnh'],
        ],
        'parking' => [
            'label' => 'Chỗ đỗ xe',
            'label_vi' => 'Chỗ để xe',
            'scopes' => ['shared'],
            'aliases' => ['motorbike parking', 'car parking'],
        ],
        'pool' => [
            'label' => 'Hồ bơi',
            'label_vi' => 'Hồ bơi',
            'scopes' => ['shared'],
            'aliases' => ['swimming pool'],
        ],
        'gym' => [
            'label' => 'Phòng tập',
            'label_vi' => 'Phòng tập',
            'scopes' => ['shared'],
            'aliases' => ['fitness room'],
        ],
        'laundry' => [
            'label' => 'Khu giặt chung',
            'label_vi' => 'Giặt là chung',
            'scopes' => ['shared'],
            'aliases' => ['shared_laundry', 'shared washing area'],
        ],
        'security' => [
            'label' => 'An ninh',
            'label_vi' => 'An ninh',
            'scopes' => ['shared'],
            'aliases' => ['security cameras', 'guard'],
        ],
        'balcony' => [
            'label' => 'Ban công',
            'label_vi' => 'Ban công',
            'scopes' => ['unit'],
            'aliases' => ['terrace'],
        ],
        'kitchen' => [
            'label' => 'Nhà bếp',
            'label_vi' => 'Bếp',
            'scopes' => ['unit'],
            'aliases' => ['cooking area'],
        ],
        'washing_machine' => [
            'label' => 'Máy giặt riêng',
            'label_vi' => 'Máy giặt',
            'scopes' => ['unit'],
            'aliases' => ['washer'],
        ],
        'refrigerator' => [
            'label' => 'Tủ lạnh',
            'label_vi' => 'Tủ lạnh',
            'scopes' => ['unit'],
            'aliases' => ['fridge'],
        ],
        'water_heater' => [
            'label' => 'Bình nước nóng',
            'label_vi' => 'Bình nước nóng',
            'scopes' => ['unit'],
            'aliases' => ['hot water'],
        ],
        'furnished' => [
            'label' => 'Có nội thất',
            'label_vi' => 'Có nội thất',
            'scopes' => ['unit'],
            'aliases' => ['furniture'],
        ],
    ];

    /**
     * @return array<int, array{key: string, label: string, label_vi: string, scope: 'PROPERTY'|'UNIT', scopes: array<int, string>, aliases: array<int, string>}>
     */
    public static function search(?string $query = null): array
    {
        $needle = $query === null ? null : self::fold(self::normalizeText($query));
        $entries = [];

        foreach (self::CATALOG as $key => $entry) {
            $searchableTerms = [$key, ...preg_split('/[\s_-]+/u', $entry['label']), ...$entry['aliases']];
            $matchesQuery = $needle === null;

            foreach ($searchableTerms as $term) {
                if (is_string($term) && str_starts_with(self::fold($term), $needle ?? '')) {
                    $matchesQuery = true;
                    break;
                }
            }

            if (! $matchesQuery) {
                continue;
            }

            $scopes = array_map(
                static fn (string $scope): string => $scope === 'shared' ? 'PROPERTY' : 'UNIT',
                $entry['scopes'],
            );
            $entries[] = [
                'key' => $key,
                ...$entry,
                'scope' => $scopes[0],
            ];
        }

        return $entries;
    }

    public static function supportsScope(string $key, string $scope): bool
    {
        return isset(self::CATALOG[$key]) && in_array($scope, self::CATALOG[$key]['scopes'], true);
    }

    /**
     * @return array<string, array{label: string, label_vi: string, scopes: array<int, string>, aliases: array<int, string>}>
     */
    public static function definitions(): array
    {
        return self::CATALOG;
    }

    /**
     * @return list<string>
     */
    public static function scopesFor(string $key): array
    {
        return self::CATALOG[$key]['scopes'] ?? [];
    }

    public static function labelFor(string $key): ?string
    {
        return self::CATALOG[$key]['label_vi'] ?? null;
    }

    /**
     * @return list<array{key: string, scope: 'PROPERTY'|'UNIT', scopes: list<'PROPERTY'|'UNIT'>, label_vi: string, label: string}>
     */
    public static function publicCatalog(): array
    {
        return array_map(static function (string $key, array $item): array {
            $scopes = array_map(
                static fn (string $scope): string => $scope === 'shared' ? 'PROPERTY' : 'UNIT',
                $item['scopes'],
            );

            return [
                'key' => $key,
                'scope' => $scopes[0],
                'scopes' => $scopes,
                'label_vi' => $item['label_vi'],
                'label' => $item['label'],
            ];
        }, array_keys(self::CATALOG), array_values(self::CATALOG));
    }

    public static function normalizeText(string $text): string
    {
        $normalized = Normalizer::normalize($text, Normalizer::FORM_C);

        if (! is_string($normalized)) {
            return $text;
        }

        $collapsed = preg_replace('/[\p{Z}\s]+/u', ' ', trim($normalized));

        return is_string($collapsed) ? $collapsed : $normalized;
    }

    /**
     * @param  array<int, mixed>  $values
     * @return array<int, mixed>
     */
    public static function normalizeUniqueList(array $values): array
    {
        $normalizedValues = [];
        $seen = [];

        foreach ($values as $value) {
            if (! is_string($value)) {
                $normalizedValues[] = $value;

                continue;
            }

            $normalized = self::normalizeText($value);
            $folded = self::fold($normalized);

            if ($normalized !== '' && isset($seen[$folded])) {
                continue;
            }

            if ($normalized !== '') {
                $seen[$folded] = true;
            }
            $normalizedValues[] = $normalized;
        }

        return $normalizedValues;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, mixed>
     */
    public static function normalizeDocument(array $document): array
    {
        if (is_array($document['custom'] ?? null)) {
            $document['custom'] = self::normalizeUniqueList($document['custom']);
        }

        if (is_array($document['standard'] ?? null)) {
            foreach ($document['standard'] as $key => $item) {
                if (is_array($item) && is_string($item['details'] ?? null)) {
                    $details = self::normalizeText($item['details']);
                    $document['standard'][$key]['details'] = $details === '' ? null : $details;
                }
            }
        }

        return $document;
    }

    /**
     * @param  array<int, mixed>  $rules
     * @return array<int, mixed>
     */
    public static function normalizeRules(array $rules): array
    {
        return self::normalizeUniqueList($rules);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function normalizeUnitInput(array $input): array
    {
        if (is_array($input['amenities'] ?? null)) {
            $input['amenities'] = self::normalizeDocument($input['amenities']);
        }

        if (is_array($input['policy_overrides'] ?? null)
            && is_array($input['policy_overrides']['additional_rules'] ?? null)) {
            $input['policy_overrides']['additional_rules'] = self::normalizeRules(
                $input['policy_overrides']['additional_rules'],
            );
        }

        return $input;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public static function validateUnitInput(array $input, string $attribute, Validator $validator): void
    {
        $prefix = $attribute === '' ? '' : $attribute.'.';

        if (is_array($input['amenities'] ?? null)) {
            self::validateDocument($input['amenities'], 'unit', $prefix.'amenities', $validator);
        }

        $additionalRules = is_array($input['policy_overrides'] ?? null)
            ? ($input['policy_overrides']['additional_rules'] ?? null)
            : null;
        if (is_array($additionalRules)) {
            self::validatePlainRules($additionalRules, $prefix.'policy_overrides.additional_rules', $validator);
        }
    }

    /**
     * @param  array<string, mixed>  $document
     */
    public static function validateDocument(
        array $document,
        string $scope,
        string $attribute,
        Validator $validator,
    ): void {
        foreach (($document['standard'] ?? []) as $key => $item) {
            if (! is_string($key) || ! self::supportsScope($key, $scope)) {
                $validator->errors()->add(
                    "{$attribute}.standard.{$key}",
                    'Vui lòng chọn tiện ích tiêu chuẩn thuộc phạm vi này.',
                );

                continue;
            }

            if (is_array($item) && is_string($item['details'] ?? null) && ! self::isPlainText($item['details'])) {
                $validator->errors()->add(
                    "{$attribute}.standard.{$key}.details",
                    'Thông tin tiện ích chỉ được chứa văn bản thuần.',
                );
            }
        }

        foreach (($document['custom'] ?? []) as $index => $label) {
            if (is_string($label) && ! self::isPlainText($label)) {
                $validator->errors()->add(
                    "{$attribute}.custom.{$index}",
                    'Tên tiện ích khác chỉ được chứa văn bản thuần.',
                );
            }
        }
    }

    /**
     * @param  array<int, mixed>  $rules
     */
    public static function validatePlainRules(array $rules, string $attribute, Validator $validator): void
    {
        foreach ($rules as $index => $rule) {
            if (is_string($rule) && ! self::isPlainText($rule)) {
                $validator->errors()->add(
                    "{$attribute}.{$index}",
                    'Rules must be plain text.',
                );
            }
        }
    }

    public static function isPlainText(string $value): bool
    {
        return preg_match('/<\s*\/?\s*[a-z][^>]*>/iu', $value) !== 1;
    }

    private static function fold(string $value): string
    {
        return mb_convert_case($value, MB_CASE_FOLD, 'UTF-8');
    }
}
