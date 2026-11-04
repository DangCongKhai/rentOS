<?php

namespace App\Models;

use App\Domain\Media\MarketedUnitPhotoQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** @property-read Property $property */
class Listing extends Model
{
    /** @use HasFactory<ListingFactory> */
    use HasFactory, HasUuids;

    protected $table = 'listings';

    /**
     * @return array<string, string>
     */
    protected $fillable = [
        'property_id',
        'client_operation_id',
        'title',
        'description',
        'cover_media_id',
        'moderation_status',
        'publication_status',
        'submitted_revision',
        'submitted_at',
        'reviewed_by',
        'reviewed_at',
        'review_reason',
        'archived_at',
        'submitted_content_revision',
        'approved_content_revision',
        'admin_suspended_at',
        'admin_suspended_by',
        'suspension_reason',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'archived_at' => 'datetime',
            'admin_suspended_at' => 'datetime',
            'submitted_revision' => 'integer',
            'submitted_content_revision' => 'integer',
            'approved_content_revision' => 'integer',
        ];
    }

    /** @return BelongsTo<Property, $this> */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class, 'property_id');
    }

    /** @return BelongsTo<PropertyMedia, $this> */
    public function cover(): BelongsTo
    {
        return $this->belongsTo(PropertyMedia::class, 'cover_media_id');
    }

    /** @return BelongsTo<PropertyMedia, $this> */
    public function coverMedia(): BelongsTo
    {
        return $this->belongsTo(PropertyMedia::class, 'cover_media_id');
    }

    /** @return HasMany<Unit, $this> */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class, 'property_id', 'property_id');
    }

    /**
     * Keep owner listings and public discovery behind the same visibility rules.
     * Date-based availability remains a separate query concern.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query->where('moderation_status', 'APPROVED')
            ->where('publication_status', 'PUBLISHED')
            ->whereNull('archived_at')
            ->whereNull('admin_suspended_at')
            ->whereHas('property', fn (Builder $property) => $property
                ->whereNull('archived_at')
                ->whereNotNull('address_line')->whereRaw("btrim(address_line) <> ''")
                ->whereNotNull('city')->whereRaw("btrim(city) <> ''")
                ->whereNotNull('description')->whereRaw("btrim(description) <> ''"))
            ->whereHas('coverMedia', fn (Builder $media) => $media
                ->whereNull('unit_id')->where('is_selected_for_listing', true)
                ->whereNull('deleted_at')->whereNull('purged_at'))
            ->whereHas('property.units', fn (Builder $unit) => $unit
                ->where('is_marketed', true)->where('operational_status', 'READY')->whereNull('archived_at')
                ->whereNotNull('description')->whereRaw("btrim(description) <> ''")
                ->whereNotNull('area_m2')->whereNotNull('advertised_monthly_rent')
                ->whereNotNull('deposit')->whereNotNull('max_occupants')
                ->where(function (Builder $hasPhoto): void {
                    MarketedUnitPhotoQuery::whereHasSelectedPhoto($hasPhoto);
                }))
            ->whereDoesntHave('property.units', fn (Builder $unit) => $unit
                ->where('is_marketed', true)
                ->where('operational_status', 'READY')
                ->whereNull('archived_at')
                ->where(function (Builder $invalid): void {
                    $invalid->whereNull('description')->orWhereRaw("btrim(description) = ''")
                        ->orWhereNull('area_m2')->orWhereNull('advertised_monthly_rent')
                        ->orWhereNull('deposit')->orWhereNull('max_occupants')
                        ->orWhere(function (Builder $missingPhoto): void {
                            MarketedUnitPhotoQuery::whereMissingSelectedPhoto($missingPhoto);
                        });
                }));
    }
}
