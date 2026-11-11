<?php

namespace App\Domain\Amenities;

use Illuminate\Validation\ValidationException;

final class AmenityCatalog
{
    /**
     * @var array<string, array{scope: 'PROPERTY'|'UNIT', label_vi: string}>
     */
    public const array KEYS = [
        'wifi' => ['scope' => 'PROPERTY', 'label_vi' => 'Wifi'],
        'elevator' => ['scope' => 'PROPERTY', 'label_vi' => 'Thang máy'],
        'laundry' => ['scope' => 'PROPERTY', 'label_vi' => 'Giặt là chung'],
        'parking' => ['scope' => 'PROPERTY', 'label_vi' => 'Chỗ để xe'],
        'air_conditioning' => ['scope' => 'UNIT', 'label_vi' => 'Máy lạnh'],
        'washing_machine' => ['scope' => 'UNIT', 'label_vi' => 'Máy giặt'],
        'kitchen' => ['scope' => 'UNIT', 'label_vi' => 'Bếp'],
    ];

    /**
     * @return 'PROPERTY'|'UNIT'
     */
    public static function scope(string $key): string
    {
        self::assertKeys([$key]);

        return self::KEYS[$key]['scope'];
    }

    /**
     * @param  list<string>  $keys
     */
    public static function assertKeys(array $keys): void
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, self::KEYS)) {
                throw ValidationException::withMessages([
                    'amenities' => 'Tiện ích không hợp lệ.',
                ]);
            }
        }
    }

    /**
     * @return list<array{key: string, scope: 'PROPERTY'|'UNIT', label_vi: string}>
     */
    public static function publicCatalog(): array
    {
        $catalog = [];
        foreach (self::KEYS as $key => $definition) {
            $catalog[] = [
                'key' => $key,
                'scope' => $definition['scope'],
                'label_vi' => $definition['label_vi'],
            ];
        }

        return $catalog;
    }
}
