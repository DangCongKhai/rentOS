<?php

namespace App\Models;

use Database\Factories\ListingFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Listing extends Model
{
    / @use HasFactory<ListingFactory> */
    use HasFactory, HasUuids;

    protected $table = 'listings';

    /
@return array<string, string>*/
protected function casts(): array{
 return ['submitted_at' => 'datetime','reviewed_at' => 'datetime','archived_at' => 'datetime',];}

    /
@return BelongsTo<Property, $this>*/
public function property(): BelongsTo{
 return $this->belongsTo(Property::class, 'property_id');}

    /
@return BelongsTo<PropertyMedia, $this>*/
public function coverMedia(): BelongsTo{
 return $this->belongsTo(PropertyMedia::class, 'cover_media_id');}

    /**
     
@return HasMany<Unit, $this>*/
  public function units(): HasMany{
      return $this->hasMany(Unit::class, 'property_id', 'property_id');}
}