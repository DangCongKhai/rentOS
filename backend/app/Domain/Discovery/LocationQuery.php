<?php

namespace App\Domain\Discovery;

use Normalizer;

final class LocationQuery
{
    public const float MIN_WORD_SIMILARITY = 0.4;

    private function __construct(private readonly string $value) {}

    public static function fromInput(?string $raw): ?self
    {
        if ($raw === null) {
            return null;
        }

        $normalized = Normalizer::normalize($raw, Normalizer::FORM_C);
        if (! is_string($normalized)) {
            $normalized = $raw;
        }

        $collapsed = preg_replace('/\s+/u', ' ', trim($normalized));
        if (! is_string($collapsed) || $collapsed === '') {
            return null;
        }

        return new self($collapsed);
    }

    public function value(): string
    {
        return $this->value;
    }
}
