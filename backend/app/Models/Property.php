<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $rental_arrangement
 * @property Carbon|null $archived_at
 */
class Property extends Model
{
    use HasUuids;

    protected $table = 'properties';

    protected $fillable = [
        'owner_id',
        'client_operation_id',
        'name',
        'property_type',
        'rental_arrangement',
        'address_line',
        'ward',
        'city',
        'description',
        'shared_amenities',
        'policies',
        'content_revision',
        'latitude',
        'longitude',
        'archived_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'shared_amenities' => 'object',
            'policies' => 'array',
            'content_revision' => 'integer',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'archived_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return HasMany<Unit, $this> */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class, 'property_id');
    }

    /** @return HasMany<PropertyMedia, $this> */
    public function media(): HasMany
    {
        return $this->hasMany(PropertyMedia::class, 'property_id');
    }

    /** @return HasMany<Listing, $this> */
    public function listings(): HasMany
    {
        return $this->hasMany(Listing::class, 'property_id');
    }
}
