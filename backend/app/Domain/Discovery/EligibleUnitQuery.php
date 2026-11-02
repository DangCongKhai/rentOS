<?php

namespace App\Domain\Discovery;

use App\Domain\Amenities\AmenityCatalog;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

final class EligibleUnitQuery
{
    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>|QueryBuilder  $unitQuery
     */
    public static function apply(Builder|QueryBuilder $unitQuery, ListingSearchCriteria $criteria, bool $requireFree = false): void
    {
        self::useWordSimilarityThreshold();
        self::constrain($unitQuery, $criteria, $requireFree);
        self::order($unitQuery, $criteria);
    }

    public static function useWordSimilarityThreshold(): void
    {
        DB::select(
            'select set_config(?, ?, true)',
            ['pg_trgm.word_similarity_threshold', (string) LocationQuery::MIN_WORD_SIMILARITY],
        );
    }

    /**
     * @return list<string>
     */
    public static function matchingListingIds(ListingSearchCriteria $criteria): array
    {
        self::useWordSimilarityThreshold();
        $requireFree = $criteria->moveInDate !== null;
        $query = Unit::query()->select('discovery_listings.id as listing_id');
        self::constrain($query, $criteria, $requireFree);

        if ($criteria->location !== null) {
            $needle = $criteria->location->value();
            $query->selectRaw('MAX('.self::relevanceExpression().') as relevance', [$needle, $needle, $needle]);
            $query->groupBy('discovery_listings.id');
            $query->orderByDesc('relevance')->orderBy('discovery_listings.id');
        } else {
            $query->selectRaw('MAX(discovery_listings.created_at) as published_at');
            $query->groupBy('discovery_listings.id');
            $query->orderByDesc('published_at')->orderBy('discovery_listings.id');
        }

        return $query->pluck('listing_id')->map(fn (mixed $id): string => (string) $id)->all();
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>|QueryBuilder  $unitQuery
     */
    public static function constrain(Builder|QueryBuilder $unitQuery, ListingSearchCriteria $criteria, bool $requireFree): void
    {
        $unitQuery
            ->join('properties as discovery_properties', 'discovery_properties.id', '=', 'units.property_id')
            ->join('listings as discovery_listings', 'discovery_listings.property_id', '=', 'discovery_properties.id')
            ->where('discovery_listings.publication_status', 'PUBLISHED')
            ->where('discovery_listings.moderation_status', 'APPROVED')
            ->whereNull('discovery_listings.archived_at')
            ->whereNull('discovery_listings.admin_suspended_at')
            ->whereNull('discovery_properties.archived_at')
            ->whereRaw("btrim(discovery_properties.address_line) <> ''")
            ->whereRaw("btrim(discovery_properties.city) <> ''")
            ->whereRaw("btrim(discovery_properties.description) <> ''")
            ->where('units.operational_status', 'READY')
            ->where('units.is_marketed', true)
            ->whereNull('units.archived_at')
            ->whereRaw("btrim(units.description) <> ''")
            ->whereNotNull('units.area_m2')
            ->whereNotNull('units.advertised_monthly_rent')
            ->whereNotNull('units.deposit')
            ->whereNotNull('units.max_occupants');

        if ($criteria->location !== null) {
            $needle = $criteria->location->value();
            $unitQuery->where(function (Builder|QueryBuilder $match) use ($needle): void {
                foreach (['address_line', 'ward', 'city'] as $column) {
                    $match->orWhereRaw(
                        self::folded('?').' <% '.self::folded('discovery_properties.'.$column),
                        [$needle],
                    );
                }
            });
        }

        if ($criteria->minRent !== null) {
            $unitQuery->where('units.advertised_monthly_rent', '>=', $criteria->minRent);
        }

        if ($criteria->maxRent !== null) {
            $unitQuery->where('units.advertised_monthly_rent', '<=', $criteria->maxRent);
        }

        if ($criteria->unitKind !== null) {
            $unitQuery->where('units.unit_kind', $criteria->unitKind);
        }

        if ($criteria->bedrooms !== null) {
            $unitQuery->where('units.bedrooms', '>=', $criteria->bedrooms);
        }

        if ($criteria->bathrooms !== null) {
            $unitQuery->where('units.bathrooms', '>=', $criteria->bathrooms);
        }

        if ($criteria->occupants !== null) {
            $unitQuery->where('units.max_occupants', '>=', $criteria->occupants);
        }

        if ($criteria->pets !== null) {
            $unitQuery->whereRaw(
                "COALESCE(units.policy_overrides->>'pets', discovery_properties.policies->>'pets') = ?",
                [$criteria->pets],
            );
        }

        foreach ($criteria->amenityKeys as $key) {
            $document = AmenityCatalog::scope($key) === 'PROPERTY'
                ? 'discovery_properties.shared_amenities'
                : 'units.amenities';
            $unitQuery->whereRaw(
                "({$document}->'standard'->?->>'enabled') = 'true'",
                [$key],
            );
        }

        if ($requireFree && $criteria->moveInDate !== null) {
            $unitQuery->whereRaw(
                "NOT EXISTS (
                    SELECT 1
                    FROM tenancies blocking
                    WHERE blocking.unit_id = units.id
                      AND blocking.status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE')
                      AND daterange(blocking.blocked_start_date, blocking.blocked_end_date + 1, '[)')
                          && daterange(?::date, (?::date + make_interval(months => units.minimum_rental_months))::date, '[)')
                )",
                [$criteria->moveInDate, $criteria->moveInDate],
            );
        }
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>|QueryBuilder  $unitQuery
     */
    private static function order(Builder|QueryBuilder $unitQuery, ListingSearchCriteria $criteria): void
    {
        if ($criteria->location === null) {
            $unitQuery->orderByDesc('discovery_listings.created_at')->orderBy('discovery_listings.id');

            return;
        }

        $needle = $criteria->location->value();
        $unitQuery->orderByRaw(self::relevanceExpression().' DESC', [$needle, $needle, $needle])
            ->orderBy('discovery_listings.id');
    }

    public static function relevanceExpression(): string
    {
        return 'GREATEST(
            word_similarity('.self::folded('?').', '.self::folded("COALESCE(discovery_properties.address_line, '')").'),
            word_similarity('.self::folded('?').', '.self::folded("COALESCE(discovery_properties.ward, '')").'),
            word_similarity('.self::folded('?').', '.self::folded("COALESCE(discovery_properties.city, '')").')
        )';
    }

    private static function folded(string $expression): string
    {
        return "lower(public.immutable_unaccent({$expression}))";
    }
}
