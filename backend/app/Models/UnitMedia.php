<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnitMedia extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $table = 'unit_media';

    protected $fillable = [
        'unit_id',
        'media_id',
        'sort_order',
        'is_selected_for_listing',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_selected_for_listing' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    /** @return BelongsTo<PropertyMedia, $this> */
    public function media(): BelongsTo
    {
        return $this->belongsTo(PropertyMedia::class, 'media_id');
    }
}
