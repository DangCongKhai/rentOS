<?php

namespace App\Actions\OwnerProperties;

use App\Models\Listing;
use App\Models\Property;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ListingLifecycleService
{
    /** @return array{listing: Listing, replayed: bool} */
    public function create(User $owner, Property $property, array $data): array
    {
        return DB::transaction(function () use ($owner, $property, $data): array {
            $owner = $this->lockOwner($owner);
            $property = $this->lockProperty($owner, $property);
            $existing = Listing::query()->where('property_id', $property->id)
                ->where('client_operation_id', $data['client_operation_id'])->first();

            if ($existing) {
                abort_unless(
                    $existing->title === trim($data['title'])
                        && $existing->description === trim($data['description'])
                        && $existing->cover_media_id === ($data['cover_media_id'] ?? null),
                    409,
                );

                return ['listing' => $existing, 'replayed' => true];
            }

            if (Listing::query()->where('property_id', $property->id)->whereNull('archived_at')->exists()) {
                abort(409, 'This property already has a current listing.');
            }

            $this->assertCover($property, $data['cover_media_id'] ?? null);
            $listing = Listing::query()->create([
                'property_id' => $property->id,
                'client_operation_id' => $data['client_operation_id'],
                'title' => trim($data['title']),
                'description' => trim($data['description']),
                'cover_media_id' => $data['cover_media_id'] ?? null,
                'moderation_status' => 'DRAFT',
                'publication_status' => 'DRAFT',
            ]);

            $this->audit($owner->id, $listing, 'listing.created', null, $this->snapshot($listing));

            return ['listing' => $listing, 'replayed' => false];
        });
    }

    public function update(User $owner, Property $property, array $data): Listing
    {
        return DB::transaction(function () use ($owner, $property, $data): Listing {
            $owner = $this->lockOwner($owner);
            $property = $this->lockProperty($owner, $property);
            $listing = $this->currentListing($property);
            abort_unless($property->content_revision === (int) $data['expected_content_revision'], 409);

            if ($listing->publication_status === 'PUBLISHED' && array_key_exists('cover_media_id', $data) && $data['cover_media_id'] === null) {
                throw ValidationException::withMessages(['cover_media_id' => 'Hide the listing before removing its cover.']);
            }

            $this->assertCover($property, $data['cover_media_id'] ?? $listing->cover_media_id);
            $before = $this->snapshot($listing);
            foreach (['title', 'description', 'cover_media_id'] as $field) {
                if (array_key_exists($field, $data)) {
                    $listing->{$field} = $field === 'cover_media_id' ? $data[$field] : trim($data[$field]);
                }
            }

            $property->content_revision++;
            $property->save();
            if ($listing->moderation_status === 'PENDING') {
                $listing->moderation_status = 'DRAFT';
                $listing->submitted_at = null;
                $listing->submitted_revision = null;
                $listing->submitted_content_revision = null;
            }
            $listing->save();
            $this->audit($owner->id, $listing, 'listing.updated', $before, $this->snapshot($listing));

            return $listing->refresh();
        });
    }

    public function submit(User $owner, Property $property, int $expectedRevision): Listing
    {
        return DB::transaction(function () use ($owner, $property, $expectedRevision): Listing {
            $owner = $this->lockOwner($owner);
            $property = $this->lockProperty($owner, $property);
            $listing = $this->currentListing($property);
            abort_unless($property->content_revision === $expectedRevision, 409);

            if (! in_array($listing->moderation_status, ['DRAFT', 'REJECTED'], true)) {
                throw ValidationException::withMessages(['listing' => 'Only a draft or rejected listing can be submitted.']);
            }

            $this->assertCompletePackage($property, $listing, requireAvailability: false);
            $before = $this->snapshot($listing);
            $listing->moderation_status = 'PENDING';
            $listing->submitted_at = now();
            $listing->submitted_revision = $property->content_revision;
            $listing->submitted_content_revision = $property->content_revision;
            $listing->reviewed_by = null;
            $listing->reviewed_at = null;
            $listing->review_reason = null;
            $listing->save();
            $this->audit($owner->id, $listing, 'listing.submitted', $before, $this->snapshot($listing));

            return $listing->refresh();
        });
    }

    public function publish(User $owner, Property $property, int $expectedRevision): Listing
    {
        return DB::transaction(function () use ($owner, $property, $expectedRevision): Listing {
            $owner = $this->lockOwner($owner);
            $property = $this->lockProperty($owner, $property);
            $listing = $this->currentListing($property);
            abort_unless($property->content_revision === $expectedRevision, 409);
            if ($listing->moderation_status !== 'APPROVED') {
                throw ValidationException::withMessages(['listing' => 'The listing must be approved before publishing.']);
            }
            if ($listing->admin_suspended_at !== null) {
                throw ValidationException::withMessages(['listing' => 'An administrator has suspended this listing.']);
            }

            $this->assertCompletePackage($property, $listing, requireAvailability: true);
            $before = $this->snapshot($listing);
            $listing->publication_status = 'PUBLISHED';
            $listing->save();
            $this->audit($owner->id, $listing, 'listing.published', $before, $this->snapshot($listing));

            return $listing->refresh();
        });
    }

    public function hide(User $owner, Property $property, int $expectedRevision): Listing
    {
        return DB::transaction(function () use ($owner, $property, $expectedRevision): Listing {
            $owner = $this->lockOwner($owner);
            $property = $this->lockProperty($owner, $property);
            $listing = $this->currentListing($property);
            abort_unless($property->content_revision === $expectedRevision, 409);
            if (! in_array($listing->publication_status, ['PUBLISHED', 'HIDDEN'], true)) {
                throw ValidationException::withMessages(['listing' => 'Only a published listing can be hidden.']);
            }
            $before = $this->snapshot($listing);
            $listing->publication_status = 'HIDDEN';
            $listing->save();
            $this->audit($owner->id, $listing, 'listing.hidden', $before, $this->snapshot($listing));

            return $listing->refresh();
        });
    }

    public function archive(User $owner, Property $property, int $expectedRevision): Listing
    {
        return DB::transaction(function () use ($owner, $property, $expectedRevision): Listing {
            $owner = $this->lockOwner($owner);
            $property = $this->lockProperty($owner, $property);
            $listing = $this->currentListing($property);
            abort_unless($property->content_revision === $expectedRevision, 409);
            $before = $this->snapshot($listing);
            $listing->publication_status = 'HIDDEN';
            $listing->archived_at = now();
            if ($listing->moderation_status === 'PENDING') {
                $listing->moderation_status = 'DRAFT';
                $listing->submitted_at = null;
                $listing->submitted_revision = null;
                $listing->submitted_content_revision = null;
            }
            $listing->save();
            $this->audit($owner->id, $listing, 'listing.archived', $before, $this->snapshot($listing));

            return $listing->refresh();
        });
    }

    public function review(User $admin, Listing $listing, bool $approve, ?string $reason = null): Listing
    {
        return DB::transaction(function () use ($admin, $listing, $approve, $reason): Listing {
            $admin = User::query()->whereKey($admin->id)->lockForUpdate()->firstOrFail();
            abort_unless($admin->isAdmin() && $admin->account_status === 'ACTIVE', 403);
            $property = Property::query()->whereKey($listing->property_id)->lockForUpdate()->firstOrFail();
            $listing = Listing::query()->whereKey($listing->id)->lockForUpdate()->firstOrFail();
            abort_unless($listing->moderation_status === 'PENDING' && $listing->archived_at === null, 409);
            abort_unless($listing->submitted_content_revision === $property->content_revision, 409);
            $before = $this->snapshot($listing);
            $listing->moderation_status = $approve ? 'APPROVED' : 'REJECTED';
            $listing->reviewed_by = $admin->id;
            $listing->reviewed_at = now();
            $listing->review_reason = $approve ? null : trim((string) $reason);
            if ($approve) {
                $listing->approved_content_revision = $listing->submitted_content_revision;
            }
            $listing->save();
            $this->audit($admin->id, $listing, $approve ? 'listing.approved' : 'listing.rejected', $before, $this->snapshot($listing));

            return $listing->refresh();
        });
    }

    private function lockOwner(User $owner): User
    {
        $owner = User::query()->whereKey($owner->id)->lockForUpdate()->firstOrFail();
        abort_unless($owner->canManageOwnerProducts(), 403);

        return $owner;
    }

    private function lockProperty(User $owner, Property $property): Property
    {
        $property = Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();
        abort_unless($property->owner_id === $owner->id && $property->archived_at === null, 404);

        return $property;
    }

    private function currentListing(Property $property): Listing
    {
        return Listing::query()->where('property_id', $property->id)->whereNull('archived_at')->lockForUpdate()->firstOrFail();
    }

    private function assertCover(Property $property, ?string $coverId): void
    {
        if ($coverId === null) {
            return;
        }
        $valid = DB::table('property_media')->where('id', $coverId)->where('property_id', $property->id)
            ->whereNull('unit_id')->where('is_selected_for_listing', true)->whereNull('deleted_at')->whereNull('purged_at')->exists();
        if (! $valid) {
            throw ValidationException::withMessages(['cover_media_id' => 'Choose a selected, live shared photo from this property.']);
        }
    }

    private function assertCompletePackage(Property $property, Listing $listing, bool $requireAvailability): void
    {
        $missing = [];
        foreach (['address_line', 'city', 'description'] as $field) {
            if (! is_string($property->{$field}) || trim($property->{$field}) === '') {
                $missing["property.{$field}"] = 'Vui lòng hoàn thiện thông tin bất động sản này trước khi gửi duyệt hoặc đăng tin.';
            }
        }
        if (trim($listing->title) === '' || trim($listing->description) === '') {
            $missing['listing'] = 'Vui lòng nhập tiêu đề và mô tả tin đăng.';
        }
        $this->assertCover($property, $listing->cover_media_id);
        if ($listing->cover_media_id === null) {
            $missing['cover_media_id'] = 'Vui lòng chọn một ảnh dùng chung làm ảnh bìa tin đăng.';
        }

        $marketed = DB::table('units')
            ->where('property_id', $property->id)
            ->where('is_marketed', true)
            ->whereNull('archived_at')
            ->get();
        $readyMarketed = $marketed->where('operational_status', 'READY');
        if ($readyMarketed->isEmpty()) {
            $missing['units'] = 'Cần ít nhất một căn đang quảng cáo và ở trạng thái sẵn sàng.';
        }
        foreach ($readyMarketed as $unit) {
            if (! is_string($unit->description) || trim($unit->description) === ''
                || $unit->area_m2 === null || $unit->advertised_monthly_rent === null || $unit->deposit === null || $unit->max_occupants === null) {
                $missing["units.{$unit->id}"] = 'Mỗi căn sẵn sàng để quảng cáo cần có mô tả, diện tích, giá thuê, tiền cọc và số người tối đa.';

                continue;
            }

            $hasSelectedLivePhoto = DB::table('property_media')
                ->where('property_id', $property->id)
                ->where('unit_id', $unit->id)
                ->where('is_selected_for_listing', true)
                ->whereNull('deleted_at')
                ->whereNull('purged_at')
                ->exists()
                || DB::table('unit_media')
                    ->join('property_media', 'property_media.id', '=', 'unit_media.media_id')
                    ->where('unit_media.unit_id', $unit->id)
                    ->where('unit_media.is_selected_for_listing', true)
                    ->where('property_media.property_id', $property->id)
                    ->whereNull('property_media.unit_id')
                    ->where('property_media.is_selected_for_listing', true)
                    ->whereNull('property_media.deleted_at')
                    ->whereNull('property_media.purged_at')
                    ->exists();

            if (! $hasSelectedLivePhoto) {
                $missing["units.{$unit->id}.photos"] = 'Tải lên và chọn ít nhất một ảnh còn hiệu lực cho mỗi căn sẵn sàng được quảng cáo.';
            }
        }

        if ($requireAvailability) {
            $today = now()->toDateString();
            $hasAvailableUnit = DB::table('units')
                ->where('property_id', $property->id)
                ->where('is_marketed', true)
                ->where('operational_status', 'READY')
                ->whereNull('archived_at')
                ->whereNotNull('description')
                ->whereRaw("btrim(description) <> ''")
                ->whereNotNull('area_m2')
                ->whereNotNull('advertised_monthly_rent')
                ->whereNotNull('deposit')
                ->whereNotNull('max_occupants')
                ->whereExists(function ($query): void {
                    $query->selectRaw('1')
                        ->from('property_media')
                        ->whereColumn('property_media.property_id', 'units.property_id')
                        ->whereColumn('property_media.unit_id', 'units.id')
                        ->where('property_media.is_selected_for_listing', true)
                        ->whereNull('property_media.deleted_at')
                        ->whereNull('property_media.purged_at');
                })
                ->whereNotExists(function ($query) use ($today): void {
                    $query->selectRaw('1')
                        ->from('tenancies')
                        ->whereColumn('tenancies.unit_id', 'units.id')
                        ->whereIn('tenancies.status', ['PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE'])
                        ->whereNotNull('tenancies.blocked_start_date')
                        ->whereNotNull('tenancies.blocked_end_date')
                        ->whereRaw(
                            "daterange(tenancies.blocked_start_date, tenancies.blocked_end_date + 1, '[)') && daterange(?::date, (?::date + make_interval(months => units.minimum_rental_months))::date, '[)')",
                            [$today, $today],
                        );
                })
                ->exists();

            if (! $hasAvailableUnit) {
                $missing['units.availability'] = 'Cần ít nhất một căn đủ điều kiện và không bị giữ trong thời hạn thuê tối thiểu tính từ hôm nay.';
            }
        }

        if ($missing !== []) {
            throw ValidationException::withMessages($missing);
        }
    }

    /** @return array<string, mixed> */
    private function snapshot(Listing $listing): array
    {
        return $listing->only(['title', 'description', 'cover_media_id', 'moderation_status', 'publication_status', 'submitted_content_revision', 'approved_content_revision', 'review_reason', 'archived_at']);
    }

    private function audit(string $actorId, Listing $listing, string $action, ?array $before, ?array $after): void
    {
        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(), 'actor_id' => $actorId, 'entity_type' => 'listing', 'entity_id' => $listing->id,
            'action' => $action, 'before_values' => $before === null ? null : json_encode($before, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'after_values' => $after === null ? null : json_encode($after, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'correlation_id' => (string) Str::uuid(), 'created_at' => now(),
        ]);
    }
}
