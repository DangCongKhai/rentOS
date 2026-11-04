<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\OwnerProperties\PropertyWriteService;
use App\Http\Controllers\Controller;
use App\Http\Requests\ArchivePropertyMediaRequest;
use App\Http\Requests\ArchivePropertyRequest;
use App\Http\Requests\ArchiveUnitRequest;
use App\Http\Requests\StorePropertyMediaRequest;
use App\Http\Requests\StorePropertyRequest;
use App\Http\Requests\StoreUnitRequest;
use App\Http\Requests\StoreUnitsBatchRequest;
use App\Http\Requests\SyncUnitSharedMediaRequest;
use App\Http\Requests\UpdatePropertyGalleryRequest;
use App\Http\Requests\UpdatePropertyRequest;
use App\Http\Requests\UpdateUnitGalleryRequest;
use App\Http\Requests\UpdateUnitRequest;
use App\Http\Resources\PropertyMediaResource;
use App\Http\Resources\PropertyResource;
use App\Http\Resources\UnitResource;
use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\PersonalAccessToken;

class OwnerPropertiesController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->canManageOwnerProducts(), 403);
        abort_if($user->currentAccessToken() instanceof PersonalAccessToken, 403);
        Gate::authorize('viewAny', Property::class);

        $properties = Property::query()
            ->where('owner_id', $user->id)
            ->when(! $request->boolean('include_archived'), fn ($query) => $query->whereNull('archived_at'))
            ->orderByDesc('created_at')
            ->with('units')
            ->paginate(20);

        return PropertyResource::collection($properties);
    }

    public function store(StorePropertyRequest $request, PropertyWriteService $propertyWriter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $result = $propertyWriter->create($user, $request->validated());

        return (new PropertyResource($result['property']))
            ->response()
            ->setStatusCode($result['replayed'] ? 200 : 201);
    }

    public function show(Request $request, Property $property): PropertyResource
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->canManageOwnerProducts(), 403);
        abort_if($user->currentAccessToken() instanceof PersonalAccessToken, 403);
        Gate::authorize('view', $property);

        return new PropertyResource($property->load('units'));
    }

    public function update(
        UpdatePropertyRequest $request,
        Property $property,
        PropertyWriteService $propertyWriter,
    ): PropertyResource {
        /** @var User $user */
        $user = $request->user();

        return new PropertyResource($propertyWriter->update($user, $property, $request->validated()));
    }

    public function archive(
        ArchivePropertyRequest $request,
        Property $property,
        PropertyWriteService $propertyWriter,
    ): PropertyResource {
        /** @var User $user */
        $user = $request->user();

        return new PropertyResource($propertyWriter->archive(
            $user,
            $property,
            (int) $request->validated('expected_content_revision'),
        ));
    }

    public function storeUnit(StoreUnitRequest $request, Property $property, PropertyWriteService $propertyWriter): JsonResponse
    {
        $unit = $propertyWriter->createUnit(
            $request->user(),
            $property,
            $request->validated()
        );

        return (new UnitResource($unit))
            ->response()
            ->setStatusCode(201);
    }

    public function updateUnit(UpdateUnitRequest $request, Property $property, Unit $unit, PropertyWriteService $propertyWriter): UnitResource
    {
        $updatedUnit = $propertyWriter->updateUnit(
            $request->user(),
            $property,
            $unit,
            $request->validated(),
        );

        return new UnitResource($updatedUnit);
    }

    public function archiveUnit(ArchiveUnitRequest $request, Property $property, Unit $unit, PropertyWriteService $propertyWriter): UnitResource
    {
        $archivedUnit = $propertyWriter->archiveUnit(
            $request->user(),
            $property,
            $unit,
            (int) $request->validated('expected_content_revision')
        );

        return new UnitResource($archivedUnit);
    }

    public function storeUnitsBatch(StoreUnitsBatchRequest $request, Property $property, PropertyWriteService $propertyWriter): JsonResponse
    {
        $result = $propertyWriter->createUnitsBatch(
            $request->user(),
            $property,
            $request->validated(),
        );

        return UnitResource::collection($result['units'])
            ->response()
            ->setStatusCode($result['replayed'] ? 200 : 201);
    }

    public function storeMedia(StorePropertyMediaRequest $request, Property $property, PropertyWriteService $propertyWriter): JsonResponse
    {
        $attributes = $request->validated();
        $photo = $attributes['photo'];
        unset($attributes['photo']);

        $result = $propertyWriter->uploadMedia(
            $request->user(),
            $property,
            $photo,
            $attributes,
        );

        return response()->json([
            'data' => [
                'media' => (new PropertyMediaResource($result['media']))->resolve($request),
                'content_revision' => $result['content_revision'],
            ],
        ], $result['replayed'] ? 200 : 201)
            ->header('Cache-Control', 'private, no-store');
    }

    public function indexMedia(Request $request, Property $property): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->canManageOwnerProducts(), 403);
        abort_if($user->currentAccessToken() instanceof PersonalAccessToken, 403);
        Gate::authorize('view', $property);

        $media = $property->media()
            ->whereNull('deleted_at')
            ->whereNull('purged_at')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $this->attachSharedAssignments($media);
        $this->attachPreviewUrls($media);

        return PropertyMediaResource::collection($media)
            ->response()
            ->header('Cache-Control', 'private, no-store');
    }

    public function updateGallery(
        UpdatePropertyGalleryRequest $request,
        Property $property,
        PropertyWriteService $propertyWriter,
    ): JsonResponse {
        $result = $propertyWriter->updateGallery(
            $request->user(),
            $property,
            $request->validated(),
        );

        return PropertyMediaResource::collection($result['media'])
            ->additional(['meta' => ['content_revision' => $result['content_revision']]])
            ->response()
            ->header('Cache-Control', 'private, no-store');
    }

    public function updateUnitGallery(
        UpdateUnitGalleryRequest $request,
        Property $property,
        Unit $unit,
        PropertyWriteService $propertyWriter,
    ): JsonResponse {
        $result = $propertyWriter->updateGallery(
            $request->user(),
            $property,
            $request->validated(),
            $unit,
        );

        return PropertyMediaResource::collection($result['media'])
            ->additional(['meta' => ['content_revision' => $result['content_revision']]])
            ->response()
            ->header('Cache-Control', 'private, no-store');
    }

    public function archiveMedia(
        ArchivePropertyMediaRequest $request,
        Property $property,
        PropertyMedia $media,
        PropertyWriteService $propertyWriter,
    ): PropertyMediaResource {
        $result = $propertyWriter->archiveMedia(
            $request->user(),
            $property,
            $media,
            $request->validated(),
        );

        return new PropertyMediaResource($result);
    }

    public function syncSharedMedia(
        SyncUnitSharedMediaRequest $request,
        Property $property,
        Unit $unit,
        PropertyWriteService $propertyWriter,
    ): JsonResponse {
        $result = $propertyWriter->syncUnitSharedMedia($request->user(), $property, $unit, $request->validated());

        return response()->json(['data' => $result]);
    }

    /**
     * @param  Collection<int, PropertyMedia>  $media
     */
    private function attachSharedAssignments(Collection $media): void
    {
        if ($media->isEmpty()) {
            return;
        }

        $assignments = DB::table('unit_media')
            ->whereIn('media_id', $media->modelKeys())
            ->get(['media_id', 'unit_id'])
            ->groupBy(fn (object $row): string => (string) $row->media_id);

        foreach ($media as $photo) {
            $photo->setAttribute(
                'assigned_unit_ids',
                collect($assignments->get((string) $photo->id, collect()))
                    ->map(fn (object $row): string => (string) $row->unit_id)
                    ->values()
                    ->all(),
            );
        }
    }

    /**
     * Attach short-lived URLs for viewing objects in the private media bucket.
     *
     * @param  Collection<int, PropertyMedia>  $media
     */
    private function attachPreviewUrls(EloquentCollection $media): void
    {
        if ($media->isEmpty()) {
            return;
        }

        $supabaseUrl = config('services.supabase.url');
        $serviceRoleKey = config('services.supabase.service_role_key');
        $bucket = config('services.supabase.storage.bucket');

        if (
            ! is_string($supabaseUrl) || ! is_string($serviceRoleKey) || ! is_string($bucket)
            || $supabaseUrl === '' || $serviceRoleKey === '' || $bucket === ''
        ) {
            return;
        }

        $previewUrls = [];

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
            ])->connectTimeout(5)->timeout(10)->post(
                rtrim($supabaseUrl, '/').'/storage/v1/object/sign/'.rawurlencode($bucket),
                [
                    'expiresIn' => 3600,
                    'paths' => $media->pluck('storage_path')->all(),
                ],
            );

            if (! $response->successful()) {
                Log::warning('Could not create property photo preview URLs.', [
                    'status' => $response->status(),
                    'bucket' => $bucket,
                    'response' => mb_substr($response->body(), 0, 500),
                ]);
            } else {
                $storageBaseUrl = rtrim($supabaseUrl, '/').'/storage/v1';

                $signedItems = $response->json();

                foreach (is_array($signedItems) ? $signedItems : [] as $item) {
                    if (! is_array($item) || ! is_string($item['path'] ?? null) || ! is_string($item['signedURL'] ?? null)) {
                        continue;
                    }

                    $signedUrl = $item['signedURL'];
                    if (! str_starts_with($signedUrl, 'http://') && ! str_starts_with($signedUrl, 'https://')) {
                        $relativeUrl = preg_replace('#^/storage/v1/#', '', $signedUrl);
                        $signedUrl = $storageBaseUrl.'/'.ltrim((string) $relativeUrl, '/');
                    }

                    $previewUrls[$item['path']] = $signedUrl;
                }
            }
        } catch (ConnectionException $exception) {
            Log::warning('Could not connect to Supabase Storage to create property photo preview URLs.', [
                'exception' => $exception::class,
            ]);
        }

        foreach ($media as $photo) {
            $photo->setAttribute('preview_url', $previewUrls[$photo->storage_path] ?? null);
        }
    }
}
