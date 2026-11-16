<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $listing_id
 * @property string $reporter_id
 * @property string $client_operation_id
 * @property string $reason_code
 * @property string $description
 * @property string $status
 * @property string|null $resolution_summary
 * @property string|null $internal_notes
 * @property string|null $reviewed_by
 * @property Carbon|null $reviewed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Listing|null $listing
 * @property-read User|null $reporter
 * @property-read User|null $reviewer
 */
class ListingReport extends Model
{
    use HasUuids;

    public const REASON_FRAUD = 'FRAUD';

    public const REASON_MISLEADING = 'MISLEADING';

    public const REASON_HARMFUL = 'HARMFUL';

    public const REASON_OTHER = 'OTHER';

    public const STATUS_OPEN = 'OPEN';

    public const STATUS_REVIEWING = 'REVIEWING';

    public const STATUS_RESOLVED = 'RESOLVED';

    public const STATUS_DISMISSED = 'DISMISSED';

    protected $table = 'listing_reports';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'listing_id',
        'reporter_id',
        'client_operation_id',
        'reason_code',
        'description',
        'status',
        'resolution_summary',
        'internal_notes',
        'reviewed_by',
        'reviewed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Listing, $this>
     */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listing_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Scope query to only reports currently active (OPEN or REVIEWING).
     *
     * @param  Builder<ListingReport>  $query
     * @return Builder<ListingReport>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_OPEN, self::STATUS_REVIEWING]);
    }

    /**
     * Scope query to reports submitted by a specific reporter.
     *
     * @param  Builder<ListingReport>  $query
     * @return Builder<ListingReport>
     */
    public function scopeForReporter(Builder $query, string $reporterId): Builder
    {
        return $query->where('reporter_id', $reporterId);
    }
}
