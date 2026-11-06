<?php

namespace App\Models;

use Database\Factories\RentalRequestFactory;
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
 */
class RentalRequest extends Model
{
    /** @use HasFactory<RentalRequestFactory> */
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'closed_at' => 'datetime',
            'confirmation_expires_at' => 'datetime',
        ];
    }
}
