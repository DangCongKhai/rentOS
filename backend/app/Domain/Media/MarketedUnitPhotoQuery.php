<?php

namespace App\Domain\Media;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

final class MarketedUnitPhotoQuery
{
    public static function whereHasSelectedPhoto(Builder|QueryBuilder $units): void
    {
        $units->where(function (Builder|QueryBuilder $hasPhoto): void {
            $hasPhoto->whereExists(function (QueryBuilder $media): void {
                self::direct($media);
            })->orWhereExists(function (QueryBuilder $shared): void {
                self::shared($shared);
            })->orWhereExists(function (QueryBuilder $gallery): void {
                self::wholeSpaceGallery($gallery);
            });
        });
    }

    public static function whereMissingSelectedPhoto(Builder|QueryBuilder $units): void
    {
        $units->where(function (Builder|QueryBuilder $missing): void {
            $missing->whereNotExists(function (QueryBuilder $media): void {
                self::direct($media);
            })->whereNotExists(function (QueryBuilder $shared): void {
                self::shared($shared);
            })->whereNotExists(function (QueryBuilder $gallery): void {
                self::wholeSpaceGallery($gallery);
            });
        });
    }

    private static function direct(QueryBuilder $media): void
    {
        $media->selectRaw('1')
            ->from('property_media')
            ->whereColumn('property_media.property_id', 'units.property_id')
            ->whereColumn('property_media.unit_id', 'units.id')
            ->where('property_media.is_selected_for_listing', true)
            ->whereNull('property_media.deleted_at')
            ->whereNull('property_media.purged_at');
    }

    private static function shared(QueryBuilder $shared): void
    {
        $shared->selectRaw('1')
            ->from('unit_media')
            ->join('property_media', 'property_media.id', '=', 'unit_media.media_id')
            ->whereColumn('unit_media.unit_id', 'units.id')
            ->where('unit_media.is_selected_for_listing', true)
            ->whereColumn('property_media.property_id', 'units.property_id')
            ->whereNull('property_media.unit_id')
            ->where('property_media.is_selected_for_listing', true)
            ->whereNull('property_media.deleted_at')
            ->whereNull('property_media.purged_at');
    }

    private static function wholeSpaceGallery(QueryBuilder $gallery): void
    {
        $gallery->selectRaw('1')
            ->from('properties as whole_property')
            ->join('property_media as gallery', 'gallery.property_id', '=', 'whole_property.id')
            ->whereColumn('whole_property.id', 'units.property_id')
            ->where('whole_property.rental_arrangement', 'WHOLE_SPACE')
            ->whereNull('gallery.unit_id')
            ->where('gallery.is_selected_for_listing', true)
            ->whereNull('gallery.deleted_at')
            ->whereNull('gallery.purged_at');
    }
}
