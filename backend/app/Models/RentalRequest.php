<?php

namespace App\Models;

use Database\Factories\RentalRequestFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $closed_at
 * @property-read string $listing_title
 * @property-read string|null $ward
 * @property-read string|null $city
 * @property-read string|null $unit_label
 * @property-read string|null $tenancy_id
 * @property-read string|null $tenancy_status
 * @property-read Carbon|null $confirmation_expires_at
 * @property-read string $property_id
 * @property-read bool|null $preferred_unit_available
 * @property-read list<array{id: string, label: string, monthly_rent: string}> $alternative_units
 */
class RentalRequest extends Model
{
    /** @use HasFactory<RentalRequestFactory> */
    use HasFactory, HasUuids;

    /** @param Builder<self> $query */
    public function scopeForOwner(Builder $query, User $owner): void
    {
        $query->whereIn('rental_requests.listing_id', Listing::query()
            ->join('properties', 'properties.id', '=', 'listings.property_id')
            ->where('properties.owner_id', $owner->id)
            ->select('listings.id'));
    }

    protected function casts(): array
    {
        return [
            'closed_at' => 'datetime',
            'confirmation_expires_at' => 'datetime',
        ];
    }
}
