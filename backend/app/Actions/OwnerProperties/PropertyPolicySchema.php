<?php

namespace App\Actions\OwnerProperties;

class PropertyPolicySchema
{
    /**
     * @return array<int, string>
     */
    public static function pets(): array
    {
        return ['NOT_ALLOWED', 'WITH_APPROVAL', 'ALLOWED', 'ASK_OWNER'];
    }

    /**
     * @return array<int, string>
     */
    public static function smoking(): array
    {
        return ['NOT_ALLOWED', 'OUTDOOR_ONLY', 'ALLOWED', 'ASK_OWNER'];
    }
}
