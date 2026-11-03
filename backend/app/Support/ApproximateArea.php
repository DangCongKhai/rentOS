<?php

namespace App\Support;

final class ApproximateArea
{
    private const SNAP_DEGREES = 0.005;

    private const RADIUS_METERS = 500;

    /**
     * @return array{latitude: float, longitude: float, radius_meters: int}|null
     */
    public static function from(mixed $latitude, mixed $longitude): ?array
    {
        if (! is_numeric($latitude) || ! is_numeric($longitude)) {
            return null;
        }

        $lat = (float) $latitude;
        $lng = (float) $longitude;
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            return null;
        }

        return [
            'latitude' => round(round($lat / self::SNAP_DEGREES) * self::SNAP_DEGREES, 6),
            'longitude' => round(round($lng / self::SNAP_DEGREES) * self::SNAP_DEGREES, 6),
            'radius_meters' => self::RADIUS_METERS,
        ];
    }
}
