<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $deleted_at
 * @property Carbon|null $purged_at
 * @property-read string|null $preview_url
 */
class PropertyMedia extends Model
{
    use HasUuids;

    protected $table = 'property_media';

    protected $fillable = [
        'property_id',
        'unit_id',
        'uploaded_by',
        'client_operation_id',
        'storage_path',
        'caption',
        'sort_order',
        'is_selected_for_listing',
        'revision',
        'purged_at',
        'deleted_at',
        'sha256',
        'mime_type',
        'size_bytes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_selected_for_listing' => 'boolean',
            'revision' => 'integer',
            'size_bytes' => 'integer',
            'purged_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Property, $this> */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class, 'property_id');
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
