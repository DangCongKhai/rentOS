<?php

namespace App\Actions\OwnerProperties;

use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class PropertyWriteService
{
    /**
     * Create a property draft and, for WHOLE_SPACE, its initial unit atomically.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{property: Property, replayed: bool}
     */
    public function create(User $owner, array $attributes): array
    {
        $operationId = $attributes['client_operation_id'];
        $requestHash = hash('sha256', json_encode($this->canonicalize($attributes), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        return DB::transaction(function () use ($owner, $attributes, $operationId, $requestHash): array {
            $owner = $this->lockActiveOwner($owner);

            $existingOperation = DB::table('idempotency_records')
                ->where('actor_id', $owner->id)
                ->where('action', 'property.create')
                ->where('client_operation_id', $operationId)
                ->first();

            if ($existingOperation !== null) {
                abort_unless(hash_equals($existingOperation->request_hash, $requestHash), 409);

                $property = Property::query()
                    ->with('units')
                    ->where('owner_id', $owner->id)
                    ->where('client_operation_id', $operationId)
                    ->firstOrFail();

                return ['property' => $property, 'replayed' => true];
            }

            abort_if(
                Property::query()
                    ->where('owner_id', $owner->id)
                    ->where('client_operation_id', $operationId)
                    ->exists(),
                409,
            );

            $property = Property::query()->create([
                'owner_id' => $owner->id,
                'client_operation_id' => $operationId,
                'content_revision' => 1,
                'name' => $attributes['name'],
                'property_type' => $attributes['property_type'],
                'rental_arrangement' => $attributes['rental_arrangement'],
                'address_line' => $attributes['address_line'] ?? null,
                'ward' => $attributes['ward'] ?? null,
                'city' => $attributes['city'] ?? null,
                'description' => $attributes['description'] ?? null,
                'shared_amenities' => $this->amenitiesObject($attributes['shared_amenities'] ?? []),
                'policies' => $attributes['policies'] ?? self::defaultPolicies(),
                'latitude' => $attributes['latitude'] ?? null,
                'longitude' => $attributes['longitude'] ?? null,
            ]);

            $units = [];
            if ($property->rental_arrangement === 'WHOLE_SPACE') {
                $units[] = $property->units()->create([
                    'client_operation_id' => (string) Str::uuid(),
                    'label' => $this->wholeSpaceLabel($property->property_type),
                    'unit_kind' => $this->wholeSpaceKind($property->property_type),
                    'bedrooms' => 0,
                    'bathrooms' => 0,
                    'bathroom_arrangement' => 'PRIVATE',
                    'minimum_rental_months' => 3,
                    'amenities' => self::emptyAmenities(),
                    'policy_overrides' => new \stdClass,
                ]);
            }

            $correlationId = $operationId;
            $afterValues = [
                'name' => $property->name,
                'property_type' => $property->property_type,
                'rental_arrangement' => $property->rental_arrangement,
                'content_revision' => $property->content_revision,
                'unit_ids' => array_map(static fn (Unit $unit): string => $unit->id, $units),
            ];

            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'property',
                entityId: $property->id,
                action: 'property.created',
                before: null,
                after: $afterValues,
                correlationId: $correlationId,
            );

            $unitIds = array_map(static fn (Unit $unit): string => $unit->id, $units);
            $resultIds = [$property->id, ...$unitIds];
            $resultArray = implode(',', array_map(static fn (string $id): string => "'{$id}'::uuid", $resultIds));

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $owner->id,
                'action' => 'property.create',
                'client_operation_id' => $operationId,
                'request_hash' => $requestHash,
                'result_resource_type' => 'property',
                'result_ids' => DB::raw("ARRAY[{$resultArray}]::uuid[]"),
                'response_status' => 201,
                'created_at' => now(),
            ]);

            return ['property' => $property->load('units'), 'replayed' => false];
        }, 3);
    }

    /**
     * Update property content only when the expected content revision is current.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function update(User $owner, Property $property, array $attributes): Property
    {
        return DB::transaction(function () use ($owner, $property, $attributes): Property {
            $property = Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();
            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);

            abort_unless($property->content_revision === (int) $attributes['expected_content_revision'], 409);

            $before = $this->auditSnapshot($property);
            unset($attributes['expected_content_revision']);
            $this->validatePublishedPropertyEdit($property, $attributes);
            if (array_key_exists('shared_amenities', $attributes)) {
                $attributes['shared_amenities'] = $this->amenitiesObject($attributes['shared_amenities']);
            }
            $property->fill($attributes);

            if (! $property->isDirty()) {
                return $property->load('units');
            }

            $property->content_revision++;
            $property->save();

            $correlationId = (string) Str::uuid();
            $invalidatedListingIds = $this->invalidatePendingListings($property);

            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'property',
                entityId: $property->id,
                action: 'property.updated',
                before: $before,
                after: $this->auditSnapshot($property),
                correlationId: $correlationId,
            );

            $this->auditInvalidatedListings($owner->id, $invalidatedListingIds, $correlationId);

            return $property->load('units');
        }, 3);
    }

    /**
     * Archive a property without deleting units, listings, requests, or tenancy history.
     */
    public function archive(User $owner, Property $property, int $expectedContentRevision): Property
    {
        return DB::transaction(function () use ($owner, $property, $expectedContentRevision): Property {
            $property = Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();
            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('archive', $property);

            if ($property->archived_at !== null) {
                return $property->load('units');
            }

            abort_unless($property->content_revision === $expectedContentRevision, 409);

            $before = $this->auditSnapshot($property);
            $property->archived_at = now();
            $property->content_revision++;
            $property->save();

            $correlationId = (string) Str::uuid();
            $invalidatedListingIds = $this->invalidatePendingListings($property);
            $publishedListingIds = DB::table('listings')
                ->where('property_id', $property->id)
                ->whereNull('archived_at')
                ->where('publication_status', 'PUBLISHED')
                ->pluck('id')
                ->all();

            if ($publishedListingIds !== []) {
                DB::table('listings')->whereIn('id', $publishedListingIds)->update([
                    'publication_status' => 'HIDDEN',
                    'updated_at' => now(),
                ]);
            }

            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'property',
                entityId: $property->id,
                action: 'property.archived',
                before: $before,
                after: $this->auditSnapshot($property),
                correlationId: $correlationId,
            );

            $this->auditInvalidatedListings($owner->id, $invalidatedListingIds, $correlationId);
            foreach ($publishedListingIds as $listingId) {
                $this->writeAudit(
                    actorId: $owner->id,
                    entityType: 'listing',
                    entityId: $listingId,
                    action: 'listing.hidden_by_property_archive',
                    before: ['publication_status' => 'PUBLISHED'],
                    after: ['publication_status' => 'HIDDEN'],
                    correlationId: $correlationId,
                );
            }

            return $property->load('units');
        }, 3);
    }

    private static function emptyAmenities(): object
    {
        return (object) ['schema_version' => 1, 'standard' => new \stdClass, 'custom' => []];
    }

    /**
     * @param  array<string, mixed>  $amenities
     */
    private function amenitiesObject(array $amenities): object
    {
        $amenities = AmenityCatalog::normalizeDocument($amenities);

        return (object) [
            'schema_version' => 1,
            'standard' => (object) ($amenities['standard'] ?? []),
            'custom' => $amenities['custom'] ?? [],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function policyOverridesObject(array $overrides): object
    {
        if (is_array($overrides['additional_rules'] ?? null)) {
            $overrides['additional_rules'] = AmenityCatalog::normalizeRules($overrides['additional_rules']);
        }

        return (object) $overrides;
    }

    /**
     * @return array{schema_version: int, pets: string, smoking: string, shared_rules: array<int, string>}
     */
    private static function defaultPolicies(): array
    {
        return [
            'schema_version' => 1,
            'pets' => 'NOT_ALLOWED',
            'smoking' => 'NOT_ALLOWED',
            'shared_rules' => [],
        ];
    }

    private function wholeSpaceLabel(string $propertyType): string
    {
        return match ($propertyType) {
            'HOUSE' => 'Entire house',
            'APARTMENT_BUILDING' => 'Entire building',
            default => 'Entire apartment',
        };
    }

    private function wholeSpaceKind(string $propertyType): string
    {
        return $propertyType === 'HOUSE' ? 'HOUSE' : 'APARTMENT';
    }

    private function lockActiveOwner(User $owner): User
    {
        $owner = User::query()->whereKey($owner->id)->lockForUpdate()->firstOrFail();
        abort_unless($owner->canManageOwnerProducts(), 403);

        return $owner;
    }

    /**
     * @return array<string, mixed>
     */
    private function auditSnapshot(Property $property): array
    {
        return [
            'name' => $property->name,
            'property_type' => $property->property_type,
            'rental_arrangement' => $property->rental_arrangement,
            'address_line' => $property->address_line,
            'ward' => $property->ward,
            'city' => $property->city,
            'description' => $property->description,
            'shared_amenities' => $property->shared_amenities,
            'policies' => $property->policies,
            'content_revision' => $property->content_revision,
            'archived_at' => $property->archived_at?->toISOString(),
        ];
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function validatePublishedPropertyEdit(Property $property, array $attributes): void
    {
        $hasPublishedListing = DB::table('listings')
            ->where('property_id', $property->id)
            ->whereNull('archived_at')
            ->where('publication_status', 'PUBLISHED')
            ->exists();

        if (! $hasPublishedListing) {
            return;
        }

        foreach (['address_line', 'city', 'description'] as $field) {
            $value = array_key_exists($field, $attributes) ? $attributes[$field] : $property->{$field};
            if (! is_string($value) || trim($value) === '') {
                throw ValidationException::withMessages([
                    $field => 'This field is required while the property has a published listing.',
                ]);
            }
        }
    }

    /**
     * @return array<int, string>
     */
    private function invalidatePendingListings(Property $property): array
    {
        $listingIds = DB::table('listings')
            ->where('property_id', $property->id)
            ->where('moderation_status', 'PENDING')
            ->pluck('id')
            ->all();

        if ($listingIds !== []) {
            DB::table('listings')->whereIn('id', $listingIds)->update([
                'moderation_status' => 'DRAFT',
                'submitted_at' => null,
                'submitted_revision' => null,
                'submitted_content_revision' => null,
                'updated_at' => now(),
            ]);
        }

        return $listingIds;
    }

    /**
     * @param  array<int, string>  $listingIds
     */
    private function auditInvalidatedListings(string $actorId, array $listingIds, string $correlationId): void
    {
        foreach ($listingIds as $listingId) {
            $this->writeAudit(
                actorId: $actorId,
                entityType: 'listing',
                entityId: $listingId,
                action: 'listing.submission_invalidated',
                before: ['moderation_status' => 'PENDING'],
                after: ['moderation_status' => 'DRAFT'],
                correlationId: $correlationId,
            );
        }
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    private function writeAudit(
        string $actorId,
        string $entityType,
        string $entityId,
        string $action,
        ?array $before,
        ?array $after,
        string $correlationId,
    ): void {
        DB::table('audit_logs')->insert([
            'id' => (string) Str::uuid(),
            'actor_id' => $actorId,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'before_values' => $before === null ? null : json_encode($before, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'after_values' => $after === null ? null : json_encode($after, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'correlation_id' => $correlationId,
            'created_at' => now(),
        ]);
    }

    private function canonicalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            return array_map(fn (mixed $item): mixed => $this->canonicalize($item), $value);
        }

        ksort($value);

        foreach ($value as $key => $item) {
            $value[$key] = $this->canonicalize($item);
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function createUnit(User $owner, Property $property, array $attributes): Unit
    {
        return DB::transaction(function () use ($owner, $property, $attributes): Unit {
            $property = Property::query()
                ->whereKey($property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);

            abort_if($property->archived_at !== null, 409);
            abort_unless($property->rental_arrangement === 'SEPARATE_UNITS', 422);

            $before = [
                'content_revision' => $property->content_revision,
                'unit_ids' => $property->units()->whereNull('archived_at')->pluck('id')->all(),
            ];

            $operationId = $attributes['client_operation_id'];
            $amenities = $attributes['amenities'] ?? [];
            unset($attributes['client_operation_id'], $attributes['amenities']);

            $unit = $property->units()->create([
                ...$attributes,
                'client_operation_id' => $operationId,
                'operational_status' => $attributes['operational_status'] ?? 'READY',
                'is_marketed' => $attributes['is_marketed'] ?? false,
                'amenities' => $this->amenitiesObject($amenities),
                'policy_overrides' => $this->policyOverridesObject($attributes['policy_overrides'] ?? []),
            ]);

            $property->content_revision++;
            $property->save();

            $correlationId = (string) Str::uuid();
            $invalidatedListingIds = $this->invalidatePendingListings($property);

            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'unit',
                entityId: $unit->id,
                action: 'unit.created',
                before: null,
                after: [
                    'property_id' => $property->id,
                    'label' => $unit->label,
                    'operational_status' => $unit->operational_status,
                    'is_marketed' => $unit->is_marketed,
                    'property_content_revision' => $property->content_revision,
                ],
                correlationId: $correlationId,
            );

            $this->auditInvalidatedListings($owner->id, $invalidatedListingIds, $correlationId);

            return $unit;
        }, 3);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateUnit(User $owner, Property $property, Unit $unit, array $attributes): Unit
    {
        return DB::transaction(function () use ($owner, $property, $unit, $attributes): Unit {
            $property = Property::query()
                ->whereKey($property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $unit = Unit::query()
                ->whereKey($unit->id)
                ->where('property_id', $property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);

            abort_if($property->archived_at !== null || $unit->archived_at !== null, 409);
            abort_unless(
                $property->content_revision === (int) $attributes['expected_content_revision'],
                409);

            $before = [
                'label' => $unit->label,
                'unit_kind' => $unit->unit_kind,
                'description' => $unit->description,
                'floor' => $unit->floor,
                'area_m2' => $unit->area_m2,
                'bedrooms' => $unit->bedrooms,
                'bathrooms' => $unit->bathrooms,
                'bathroom_arrangement' => $unit->bathroom_arrangement,
                'advertised_monthly_rent' => $unit->advertised_monthly_rent,
                'deposit' => $unit->deposit,
                'minimum_rental_months' => $unit->minimum_rental_months,
                'max_occupants' => $unit->max_occupants,
                'operational_status' => $unit->operational_status,
                'is_marketed' => $unit->is_marketed,
                'amenities' => $unit->amenities,
                'policy_overrides' => $unit->policy_overrides,
                'property_content_revision' => $property->content_revision];

            unset($attributes['expected_content_revision']);

            if (array_key_exists('amenities', $attributes)) {
                $amenities = $attributes['amenities'];
                $attributes['amenities'] = $this->amenitiesObject($amenities);
            }

            if (array_key_exists('policy_overrides', $attributes)) {
                $attributes['policy_overrides'] = $this->policyOverridesObject($attributes['policy_overrides']);
            }

            if (isset($attributes['label'])) {
                $duplicateLabel = Unit::query()
                    ->where('property_id', $property->id)
                    ->where('id', '<>', $unit->id)
                    ->whereRaw('lower(btrim(label)) = lower(btrim(?))', [$attributes['label']])
                    ->exists();

                if ($duplicateLabel) {
                    throw ValidationException::withMessages([
                        'label' => 'This label is already used by another unit.',
                    ]);
                }
            }

            $unit->fill($attributes);

            if (! $unit->isDirty()) {
                return $unit;
            }

            $unit->save();

            $property->content_revision++;
            $property->save();

            $correlationId = (string) Str::uuid();
            $invalidatedListingIds = $this->invalidatePendingListings($property);

            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'unit',
                entityId: $unit->id,
                action: 'unit.updated',
                before: $before,
                after: [
                    'label' => $unit->label,
                    'unit_kind' => $unit->unit_kind,
                    'description' => $unit->description,
                    'floor' => $unit->floor,
                    'area_m2' => $unit->area_m2,
                    'bedrooms' => $unit->bedrooms,
                    'bathrooms' => $unit->bathrooms,
                    'bathroom_arrangement' => $unit->bathroom_arrangement,
                    'advertised_monthly_rent' => $unit->advertised_monthly_rent,
                    'deposit' => $unit->deposit,
                    'minimum_rental_months' => $unit->minimum_rental_months,
                    'max_occupants' => $unit->max_occupants,
                    'operational_status' => $unit->operational_status,
                    'is_marketed' => $unit->is_marketed,
                    'amenities' => $unit->amenities,
                    'policy_overrides' => $unit->policy_overrides,
                    'property_content_revision' => $property->content_revision,
                ],
                correlationId: $correlationId,
            );

            $this->auditInvalidatedListings($owner->id, $invalidatedListingIds, $correlationId);

            return $unit;
        }, 3);
    }

    public function archiveUnit(User $owner, Property $property, Unit $unit, int $expectedContentRevision): Unit
    {
        return DB::transaction(function () use ($owner, $property, $unit, $expectedContentRevision): Unit {
            $property = Property::query()
                ->whereKey($property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $unit = Unit::query()
                ->whereKey($unit->id)
                ->where('property_id', $property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);

            abort_unless($property->rental_arrangement === 'SEPARATE_UNITS', 422);

            if ($unit->archived_at !== null) {
                return $unit;
            }

            abort_if($property->archived_at !== null, 409);
            abort_unless($property->content_revision === $expectedContentRevision, 409);

            $before = [
                'label' => $unit->label,
                'operational_status' => $unit->operational_status,
                'is_marketed' => $unit->is_marketed,
                'archived_at' => null,
                'property_content_revision' => $property->content_revision,
            ];

            $unit->archived_at = now();
            $unit->is_marketed = false;
            $unit->save();

            $property->content_revision++;
            $property->save();

            $correlationId = (string) Str::uuid();
            $invalidatedListingIds = $this->invalidatePendingListings($property);

            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'unit',
                entityId: $unit->id,
                action: 'unit.archived',
                before: $before,
                after: [
                    'label' => $unit->label,
                    'operational_status' => $unit->operational_status,
                    'is_marketed' => $unit->is_marketed,
                    'archived_at' => $unit->archived_at->toISOString(),
                    'property_content_revision' => $property->content_revision,
                ],
                correlationId: $correlationId
            );

            $this->auditInvalidatedListings(
                $owner->id,
                $invalidatedListingIds,
                $correlationId
            );

            return $unit;
        }, 3);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{units: array<int, Unit>, replayed: bool}
     */
    public function createUnitsBatch(User $owner, Property $property, array $attributes): array
    {
        $batchOperationId = $attributes['client_operation_id'];
        $rows = $attributes['units'];

        $requestHash = hash(
            'sha256',
            json_encode(
                $this->canonicalize($attributes),
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
            )
        );

        return DB::transaction(function () use ($owner, $property, $attributes, $batchOperationId, $requestHash, $rows): array {
            $property = Property::query()
                ->whereKey($property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);

            abort_if($property->archived_at !== null, 409);
            abort_unless($property->rental_arrangement === 'SEPARATE_UNITS', 422);

            $existingBatch = DB::table('idempotency_records')
                ->where('actor_id', $owner->id)
                ->where('action', 'unit.bulk.create')
                ->where('client_operation_id', $batchOperationId)
                ->first();

            if ($existingBatch !== null) {
                abort_unless(hash_equals($existingBatch->request_hash, $requestHash), 409);

                $operationIds = array_column($rows, 'client_operation_id');
                $unitsByOperation = $property->units()
                    ->whereIn('client_operation_id', $operationIds)
                    ->get()
                    ->keyBy('client_operation_id');

                abort_unless($unitsByOperation->count() === count($rows), 409);

                return [
                    'units' => array_map(
                        fn (array $row): Unit => $unitsByOperation[$row['client_operation_id']],
                        $rows,
                    ),
                    'replayed' => true,
                ];
            }

            abort_unless($property->content_revision === (int) $attributes['expected_content_revision'], 409);

            $seenLabels = [];

            foreach ($rows as $index => $row) {
                $labelKey = mb_strtolower(trim($row['label']));

                if (isset($seenLabels[$labelKey])) {
                    throw ValidationException::withMessages([
                        "units.{$index}.label" => 'This label duplicates another unit in the batch.',
                    ]);
                }

                $seenLabels[$labelKey] = true;

                $labelExists = Unit::query()
                    ->where('property_id', $property->id)
                    ->whereRaw('lower(btrim(label)) = lower(btrim(?))', [$row['label']])
                    ->exists();

                if ($labelExists) {
                    throw ValidationException::withMessages([
                        "units.{$index}.label" => 'This label is already used by a unit on this property.',
                    ]);
                }
            }

            $createdUnits = [];
            $correlationId = $batchOperationId;

            foreach ($rows as $row) {
                $amenities = $row['amenities'] ?? [];
                unset($row['amenities']);

                $unit = $property->units()->create([
                    ...$row,
                    'operational_status' => $row['operational_status'] ?? 'READY',
                    'is_marketed' => false,
                    'amenities' => $this->amenitiesObject($amenities),
                    'policy_overrides' => $this->policyOverridesObject($row['policy_overrides'] ?? []),
                ]);

                $createdUnits[] = $unit;

                $this->writeAudit(
                    actorId: $owner->id,
                    entityType: 'unit',
                    entityId: $unit->id,
                    action: 'unit.created',
                    before: null,
                    after: [
                        'property_id' => $property->id,
                        'label' => $unit->label,
                        'operational_status' => $unit->operational_status,
                        'is_marketed' => false,
                        'property_content_revision' => $property->content_revision + 1,
                    ],
                    correlationId: $correlationId,
                );
            }

            $property->content_revision++;
            $property->save();

            $invalidatedListingIds = $this->invalidatePendingListings($property);
            $this->auditInvalidatedListings($owner->id, $invalidatedListingIds, $correlationId);

            $unitIds = array_map(
                static fn (Unit $unit): string => $unit->id,
                $createdUnits,
            );
            $resultIdsSql = implode(
                ',',
                array_map(static fn (string $id): string => "'{$id}'::uuid", $unitIds),
            );

            DB::table('idempotency_records')->insert([
                'id' => (string) Str::uuid(),
                'actor_id' => $owner->id,
                'action' => 'unit.bulk.create',
                'client_operation_id' => $batchOperationId,
                'request_hash' => $requestHash,
                'result_resource_type' => 'units',
                'result_ids' => DB::raw("ARRAY[{$resultIdsSql}]::uuid[]"),
                'response_status' => 201,
                'created_at' => now(),
            ]);

            return ['units' => $createdUnits, 'replayed' => false];
        }, 3);
    }

    /**
     * Update ordering and listing selection for shared property photos.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{media: EloquentCollection<int, PropertyMedia>, content_revision: int}
     */
    public function updateGallery(User $owner, Property $property, array $attributes, ?Unit $unit = null): array
    {
        return DB::transaction(function () use ($owner, $property, $attributes, $unit): array {
            $property = Property::query()
                ->whereKey($property->id)
                ->lockForUpdate()
                ->firstOrFail();

            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);

            if ($unit !== null) {
                $unit = Unit::query()->whereKey($unit->id)->where('property_id', $property->id)
                    ->whereNull('archived_at')->lockForUpdate()->firstOrFail();
            }

            abort_if($property->archived_at !== null, 409);
            abort_unless(
                $property->content_revision === (int) $attributes['expected_content_revision'],
                409,
            );

            $items = $attributes['items'];
            $mediaIds = array_column($items, 'media_id');
            $mediaById = PropertyMedia::query()
                ->where('property_id', $property->id)
                ->where('unit_id', $unit?->id)
                ->whereNull('deleted_at')
                ->whereNull('purged_at')
                ->whereIn('id', $mediaIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($mediaById->count() !== count($mediaIds)) {
                throw ValidationException::withMessages([
                    'items' => 'Every photo must be active and belong to the selected property or unit.',
                ]);
            }

            $changedItems = [];
            $deselectedCoverIds = [];

            foreach ($items as $item) {
                /** @var PropertyMedia $media */
                $media = $mediaById->get($item['media_id']);

                abort_unless($media->revision === (int) $item['revision'], 409);

                $isSelected = (bool) $item['is_selected_for_listing'];
                if (
                    $media->sort_order === (int) $item['sort_order']
                    && $media->is_selected_for_listing === $isSelected
                ) {
                    continue;
                }

                if (! $isSelected) {
                    $deselectedCoverIds[] = $media->id;
                }

                $changedItems[] = [
                    'media' => $media,
                    'before' => [
                        'sort_order' => $media->sort_order,
                        'is_selected_for_listing' => $media->is_selected_for_listing,
                        'revision' => $media->revision,
                    ],
                    'sort_order' => (int) $item['sort_order'],
                    'is_selected_for_listing' => $isSelected,
                ];
            }

            if ($deselectedCoverIds !== [] && DB::table('listings')
                ->where('property_id', $property->id)
                ->whereIn('cover_media_id', $deselectedCoverIds)
                ->exists()) {
                throw ValidationException::withMessages([
                    'items' => 'Replace a listing cover before removing that photo from the selected gallery.',
                ]);
            }

            if ($changedItems !== []) {
                $correlationId = (string) Str::uuid();
                $nextContentRevision = $property->content_revision + 1;

                foreach ($changedItems as $change) {
                    /** @var PropertyMedia $media */
                    $media = $change['media'];
                    $media->sort_order = $change['sort_order'];
                    $media->is_selected_for_listing = $change['is_selected_for_listing'];
                    $media->revision++;
                    $media->save();

                    $this->writeAudit(
                        actorId: $owner->id,
                        entityType: 'property_media',
                        entityId: $media->id,
                        action: 'property_media.gallery_updated',
                        before: $change['before'],
                        after: [
                            'sort_order' => $media->sort_order,
                            'is_selected_for_listing' => $media->is_selected_for_listing,
                            'revision' => $media->revision,
                            'property_content_revision' => $nextContentRevision,
                        ],
                        correlationId: $correlationId,
                    );
                }

                $property->content_revision = $nextContentRevision;
                $property->save();

                $invalidatedListingIds = $this->invalidatePendingListings($property);
                $this->auditInvalidatedListings($owner->id, $invalidatedListingIds, $correlationId);
            }

            $media = PropertyMedia::query()
                ->where('property_id', $property->id)
                ->where('unit_id', $unit?->id)
                ->whereNull('deleted_at')
                ->whereNull('purged_at')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();

            return [
                'media' => $media,
                'content_revision' => $property->content_revision,
            ];
        }, 3);
    }

    /**
     * Soft-remove a photo while preserving its immutable storage object and audit history.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function archiveMedia(User $owner, Property $property, PropertyMedia $media, array $attributes): PropertyMedia
    {
        return DB::transaction(function () use ($owner, $property, $media, $attributes): PropertyMedia {
            $property = Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();
            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);
            abort_if($property->archived_at !== null, 409);
            abort_unless($property->content_revision === (int) $attributes['expected_content_revision'], 409);

            $media = PropertyMedia::query()->whereKey($media->id)->where('property_id', $property->id)
                ->whereNull('deleted_at')->whereNull('purged_at')->lockForUpdate()->firstOrFail();
            abort_unless($media->revision === (int) $attributes['revision'], 409);

            if (DB::table('listings')->where('property_id', $property->id)->where('cover_media_id', $media->id)->exists()) {
                throw ValidationException::withMessages([
                    'media' => 'Choose a different cover before removing this photo.',
                ]);
            }

            if ($media->unit_id !== null && $media->is_selected_for_listing) {
                $isRequiredForCurrentListing = DB::table('units')->where('id', $media->unit_id)
                    ->where('is_marketed', true)->whereNull('archived_at')->exists()
                    && DB::table('listings')->where('property_id', $property->id)->whereNull('archived_at')
                        ->where(function (Builder $query): void {
                            $query->where('moderation_status', 'PENDING')->orWhere('publication_status', 'PUBLISHED');
                        })->exists();
                $hasReplacement = DB::table('property_media')->where('property_id', $property->id)
                    ->where('unit_id', $media->unit_id)->where('id', '<>', $media->id)
                    ->where('is_selected_for_listing', true)->whereNull('deleted_at')->whereNull('purged_at')->exists();

                if ($isRequiredForCurrentListing && ! $hasReplacement) {
                    throw ValidationException::withMessages([
                        'media' => 'Upload and select a replacement photo for this marketed room first.',
                    ]);
                }
            }

            $before = [
                'deleted_at' => null,
                'revision' => $media->revision,
                'is_selected_for_listing' => $media->is_selected_for_listing,
            ];
            $media->deleted_at = now();
            $media->is_selected_for_listing = false;
            $media->revision++;
            $media->save();
            $property->content_revision++;
            $property->save();

            $correlationId = (string) Str::uuid();
            $invalidatedListingIds = $this->invalidatePendingListings($property);
            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'property_media',
                entityId: $media->id,
                action: 'property_media.removed',
                before: $before,
                after: [
                    'deleted_at' => $media->deleted_at->toISOString(),
                    'revision' => $media->revision,
                    'property_content_revision' => $property->content_revision,
                ],
                correlationId: $correlationId,
            );
            $this->auditInvalidatedListings($owner->id, $invalidatedListingIds, $correlationId);

            return $media;
        }, 3);
    }

    private function deleteStoredObject(string $supabaseUrl, string $serviceRoleKey, string $bucket, string $storagePath): void
    {
        $encodedPath = implode('/', array_map(
            'rawurlencode',
            explode('/', $storagePath),
        ));

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
            ])
                ->connectTimeout((int) config('services.supabase.storage.connect_timeout', 5))
                ->timeout((int) config('services.supabase.storage.timeout', 30))
                ->delete(
                    rtrim($supabaseUrl, '/')
                    .'/storage/v1/object/'.rawurlencode($bucket).'/'.$encodedPath,
                );

            if (! $response->successful()) {
                Log::warning('Could not remove an unreferenced uploaded media object.', [
                    'storage_path' => $storagePath,
                    'status' => $response->status(),
                ]);
            }
        } catch (Throwable $exception) {
            Log::warning('Could not remove an unreferenced uploaded media object.', [
                'storage_path' => $storagePath,
                'exception' => $exception::class,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{media: PropertyMedia, replayed: bool}
     */
    public function uploadMedia(User $owner, Property $property, UploadedFile $photo, array $attributes): array
    {
        $mimeType = $photo->getMimeType();
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];

        abort_unless(isset($extensions[$mimeType]), 422);

        $sha256 = hash_file('sha256', $photo->getRealPath());
        $sizeBytes = $photo->getSize();

        abort_unless(is_string($sha256) && is_int($sizeBytes) && $sizeBytes > 0, 422);

        $operationId = $attributes['client_operation_id'];
        $unitId = $attributes['unit_id'] ?? null;
        $caption = $attributes['caption'] ?? null;
        $mediaId = (string) Str::uuid();
        $storagePath = "properties/{$property->id}/media/{$mediaId}.{$extensions[$mimeType]}";

        $supabaseUrl = config('services.supabase.url');
        $serviceRoleKey = config('services.supabase.service_role_key');
        $bucket = config('services.supabase.storage.bucket');

        abort_unless(
            is_string($supabaseUrl)
                && is_string($serviceRoleKey)
                && is_string($bucket)
                && $supabaseUrl !== ''
                && $serviceRoleKey !== ''
                && $bucket !== '',
            503,
            'Photo storage is not configured.',
        );

        $encodedPath = implode('/', array_map(
            'rawurlencode',
            explode('/', $storagePath),
        ));

        $storageUrl = rtrim($supabaseUrl, '/')
            .'/storage/v1/object/'.rawurlencode($bucket).'/'.$encodedPath;

        $headers = [
            'Authorization' => 'Bearer '.$serviceRoleKey,
            'apikey' => $serviceRoleKey,
            'x-upsert' => 'false',
        ];

        try {
            $uploadResponse = Http::withHeaders($headers)
                ->connectTimeout((int) config('services.supabase.storage.connect_timeout', 5))
                ->timeout((int) config('services.supabase.storage.timeout', 30))
                ->withBody($photo->getContent(), $mimeType)
                ->post($storageUrl);
        } catch (ConnectionException) {
            abort(503, 'Photo storage is unavailable.');
        }

        if (! $uploadResponse->successful()) {
            $storageError = $uploadResponse->json('message');
            $storageError = is_string($storageError) && $storageError !== ''
                ? $storageError
                : trim($uploadResponse->body());
            $storageError = mb_substr($storageError, 0, 500);

            Log::warning('Supabase Storage rejected a property photo upload.', [
                'status' => $uploadResponse->status(),
                'bucket' => $bucket,
                'storage_path' => $storagePath,
                'response' => $storageError,
            ]);

            $message = app()->environment('local') && $storageError !== ''
                ? 'Photo upload failed: '.mb_substr($storageError, 0, 300)
                : 'Photo upload failed.';

            abort(502, $message);
        }

        try {
            $result = DB::transaction(function () use (
                $owner,
                $property,
                $attributes,
                $operationId,
                $unitId,
                $caption,
                $mediaId,
                $storagePath,
                $sha256,
                $sizeBytes,
                $mimeType,
            ): array {
                $property = Property::query()
                    ->whereKey($property->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $owner = $this->lockActiveOwner($owner);
                Gate::authorize('update', $property);

                $existing = PropertyMedia::query()
                    ->where('uploaded_by', $owner->id)
                    ->where('client_operation_id', $operationId)
                    ->first();

                if ($existing !== null) {
                    abort_unless(
                        $existing->property_id === $property->id
                            && $existing->unit_id === $unitId
                            && $existing->caption === $caption
                            && $existing->sha256 === $sha256,
                        409,
                    );

                    return ['media' => $existing, 'replayed' => true];
                }

                abort_if($property->archived_at !== null, 409);
                abort_unless(
                    $property->content_revision === (int) $attributes['expected_content_revision'],
                    409,
                );

                if ($unitId !== null) {
                    $unit = Unit::query()
                        ->whereKey($unitId)
                        ->where('property_id', $property->id)
                        ->whereNull('archived_at')
                        ->first();

                    abort_if($unit === null, 422);
                }

                $activeMediaCount = $property->media()
                    ->whereNull('deleted_at')
                    ->whereNull('purged_at')
                    ->count();

                abort_if(
                    $activeMediaCount >= (int) config(
                        'services.supabase.storage.max_media_per_property',
                        20,
                    ),
                    422,
                    'This property has reached its photo limit.',
                );

                $sortOrder = (int) ($property->media()->max('sort_order') ?? -1) + 1;

                $media = $property->media()->create([
                    'id' => $mediaId,
                    'unit_id' => $unitId,
                    'uploaded_by' => $owner->id,
                    'client_operation_id' => $operationId,
                    'storage_path' => $storagePath,
                    'caption' => $caption,
                    'sort_order' => $sortOrder,
                    'is_selected_for_listing' => true,
                    'sha256' => $sha256,
                    'mime_type' => $mimeType,
                    'size_bytes' => $sizeBytes,
                ]);

                $property->content_revision++;
                $property->save();

                $correlationId = (string) Str::uuid();
                $invalidatedListingIds = $this->invalidatePendingListings($property);

                $this->writeAudit(
                    actorId: $owner->id,
                    entityType: 'property_media',
                    entityId: $media->id,
                    action: 'property_media.uploaded',
                    before: null,
                    after: [
                        'property_id' => $property->id,
                        'unit_id' => $media->unit_id,
                        'mime_type' => $media->mime_type,
                        'size_bytes' => $media->size_bytes,
                        'sha256' => $media->sha256,
                        'property_content_revision' => $property->content_revision,
                    ],
                    correlationId: $correlationId,
                );

                $this->auditInvalidatedListings(
                    $owner->id,
                    $invalidatedListingIds,
                    $correlationId,
                );

                return ['media' => $media, 'replayed' => false];
            }, 3);
        } catch (Throwable $exception) {
            $this->deleteStoredObject($supabaseUrl, $serviceRoleKey, $bucket, $storagePath);
            throw $exception;
        }

        if ($result['replayed']) {
            $this->deleteStoredObject($supabaseUrl, $serviceRoleKey, $bucket, $storagePath);
        }

        return $result;
    }

    /**
     * @param  array{expected_content_revision: int, media_ids: list<string>}  $attributes
     * @return array{content_revision: int}
     */
    public function syncUnitSharedMedia(User $owner, Property $property, Unit $unit, array $attributes): array
    {
        return DB::transaction(function () use ($owner, $property, $unit, $attributes): array {
            $property = Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();
            $owner = $this->lockActiveOwner($owner);
            Gate::authorize('update', $property);
            abort_if($property->archived_at !== null, 409);
            abort_unless($property->content_revision === (int) $attributes['expected_content_revision'], 409);

            $unit = Unit::query()->whereKey($unit->id)->where('property_id', $property->id)
                ->whereNull('archived_at')->lockForUpdate()->firstOrFail();

            /** @var list<string> $mediaIds */
            $mediaIds = array_values($attributes['media_ids']);
            $shared = PropertyMedia::query()
                ->where('property_id', $property->id)
                ->whereNull('unit_id')
                ->whereNull('deleted_at')
                ->whereNull('purged_at')
                ->whereIn('id', $mediaIds)
                ->pluck('id');

            if ($shared->count() !== count($mediaIds)) {
                throw ValidationException::withMessages([
                    'media_ids' => 'Mỗi ảnh phải là ảnh dùng chung đang hoạt động của bất động sản này.',
                ]);
            }

            $before = DB::table('unit_media')->where('unit_id', $unit->id)->orderBy('media_id')->pluck('media_id')->all();
            DB::table('unit_media')->where('unit_id', $unit->id)->delete();
            $now = now();
            foreach ($mediaIds as $index => $mediaId) {
                DB::table('unit_media')->insert([
                    'unit_id' => $unit->id,
                    'media_id' => $mediaId,
                    'sort_order' => $index,
                    'is_selected_for_listing' => true,
                    'created_at' => $now,
                ]);
            }

            $property->content_revision++;
            $property->save();

            $this->writeAudit(
                actorId: $owner->id,
                entityType: 'unit',
                entityId: $unit->id,
                action: 'unit.shared_media_updated',
                before: ['media_ids' => $before],
                after: [
                    'media_ids' => $mediaIds,
                    'property_content_revision' => $property->content_revision,
                ],
                correlationId: (string) Str::uuid(),
            );

            return ['content_revision' => $property->content_revision];
        });
    }
}
