<?php

namespace App\Domain\Discovery;

use Carbon\CarbonImmutable;

final class UnitAvailability
{
    /**
     * @param  list<array{start: string, end: string}>  $blocks
     * @return array{available_now: bool, available_from: ?string, available_until: ?string, label: string}
     */
    public static function describe(string $today, array $blocks): array
    {
        $todayDate = CarbonImmutable::parse($today)->startOfDay();
        $normalized = self::normalizedBlocks($blocks);

        $occupiedUntil = self::occupiedUntil($todayDate, $normalized);
        if ($occupiedUntil !== null) {
            $availableFrom = $occupiedUntil->addDay();

            return [
                'available_now' => false,
                'available_from' => $availableFrom->toDateString(),
                'available_until' => null,
                'label' => 'Trống từ '.$availableFrom->format('d/m/Y'),
            ];
        }

        $nextStart = null;
        foreach ($normalized as $block) {
            if ($block['start']->greaterThan($todayDate) && ($nextStart === null || $block['start']->lessThan($nextStart))) {
                $nextStart = $block['start'];
            }
        }

        if ($nextStart === null) {
            return [
                'available_now' => true,
                'available_from' => null,
                'available_until' => null,
                'label' => 'Còn trống',
            ];
        }

        $availableUntil = $nextStart->subDay();

        return [
            'available_now' => true,
            'available_from' => null,
            'available_until' => $availableUntil->toDateString(),
            'label' => 'Còn trống đến '.$availableUntil->format('d/m/Y'),
        ];
    }

    /**
     * @param  list<array{start: string, end: string}>  $blocks
     */
    public static function stayIsFree(string $moveIn, int $minimumMonths, array $blocks): bool
    {
        $stayStart = CarbonImmutable::parse($moveIn)->startOfDay();
        $stayEnd = $stayStart->addMonths($minimumMonths);

        foreach (self::normalizedBlocks($blocks) as $block) {
            if ($block['start']->lessThan($stayEnd) && $block['end']->greaterThanOrEqualTo($stayStart)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  list<array{start: string, end: string}>  $blocks
     * @return list<array{start: CarbonImmutable, end: CarbonImmutable}>
     */
    private static function normalizedBlocks(array $blocks): array
    {
        $normalized = [];
        foreach ($blocks as $block) {
            $normalized[] = [
                'start' => CarbonImmutable::parse($block['start'])->startOfDay(),
                'end' => CarbonImmutable::parse($block['end'])->startOfDay(),
            ];
        }

        usort($normalized, fn (array $left, array $right): int => $left['start']->getTimestamp() <=> $right['start']->getTimestamp());

        return $normalized;
    }

    /**
     * @param  list<array{start: CarbonImmutable, end: CarbonImmutable}>  $blocks
     */
    private static function occupiedUntil(CarbonImmutable $today, array $blocks): ?CarbonImmutable
    {
        $occupiedUntil = null;
        foreach ($blocks as $block) {
            if ($block['start']->greaterThan($today) || $block['end']->lessThan($today)) {
                continue;
            }

            $occupiedUntil = $block['end'];
            break;
        }

        if ($occupiedUntil === null) {
            return null;
        }

        $extended = true;
        while ($extended) {
            $extended = false;
            foreach ($blocks as $block) {
                if ($block['start']->lessThanOrEqualTo($occupiedUntil->addDay()) && $block['end']->greaterThan($occupiedUntil)) {
                    $occupiedUntil = $block['end'];
                    $extended = true;
                }
            }
        }

        return $occupiedUntil;
    }
}
