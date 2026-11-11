<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Discovery\ListingPresentation;
use App\Domain\Discovery\ListingSearchCriteria;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicListingCardResource;
use App\Models\Listing;
use App\Policies\FavouritePropertyPolicy;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class FavouritePropertiesController extends Controller
{
    public function __construct(private FavouritePropertyPolicy $policy) {}

    #[Response(200, type: 'array{data: array{items: list<array{property_id: string, listing: PublicListingCardResource|null}>, page: int, last_page: int, total: int}}')]
    public function index(Request $request, ListingPresentation $presentation): JsonResponse
    {
        Gate::allowIf($this->policy->read(...));
        $input = $request->validate([
            'page' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'move_in_date' => ['nullable', 'date_format:Y-m-d'],
            'sort' => ['nullable', Rule::in(['newest', 'oldest'])],
            'search' => ['nullable', 'string', 'max:120', 'not_regex:/\x00/'],
        ]);
        $saved = $this->owned($request);
        $visible = Listing::query()->publiclyVisible()
            ->whereIn('listings.property_id', (clone $saved)->select('property_id'))
            ->selectRaw('DISTINCT ON (listings.property_id) listings.property_id, listings.id, listings.title')
            ->orderBy('listings.property_id')->orderByDesc('listings.created_at')->orderByDesc('listings.id');
        $saved->leftJoinSub($visible, 'visible', 'visible.property_id', '=', 'favourite_properties.property_id');
        if (($input['search'] ?? '') !== '') {
            $term = addcslashes($input['search'], '\\%_');
            $saved->where('visible.title', 'ilike', '%'.$term.'%');
        }
        $direction = ($input['sort'] ?? 'newest') === 'oldest' ? 'asc' : 'desc';
        $results = $saved->orderBy('favourite_properties.created_at', $direction)
            ->orderBy('favourite_properties.property_id')
            ->paginate(12, ['favourite_properties.property_id', 'visible.id as listing_id'], 'page', (int) ($input['page'] ?? 1));

        $criteria = new ListingSearchCriteria(null, $input['move_in_date'] ?? null, null, null, null, null, null, null, [], null, 1, 12);
        $cards = $presentation->cardsFor($results->getCollection()->pluck('listing_id')->filter()->values()->all(), $criteria, requireFree: false)->keyBy('id');

        $items = [];
        foreach ($results->items() as $row) {
            $card = $cards->get($row->listing_id ?? '');

            $items[] = [
                'property_id' => $row->property_id,
                'listing' => $card === null ? null : (new PublicListingCardResource($card))->resolve($request),
            ];
        }

        return $this->privateJson([
            'items' => $items,
            'page' => $results->currentPage(),
            'last_page' => $results->lastPage(),
            'total' => $results->total(),
        ]);
    }

    #[Response(200, type: 'array{data: array{ids: list<string>, count: int}}')]
    public function ids(Request $request): JsonResponse
    {
        Gate::allowIf($this->policy->read(...));
        $ids = $this->owned($request)->orderBy('property_id')->pluck('property_id');

        return $this->privateJson(['ids' => $ids, 'count' => $ids->count()]);
    }

    #[Response(200, type: 'array{data: array{count: int}}')]
    public function count(Request $request): JsonResponse
    {
        Gate::allowIf($this->policy->read(...));

        return $this->privateJson(['count' => $this->owned($request)->count()]);
    }

    #[Response(201, type: 'array{data: array{property_id: string}}')]
    #[Response(200, type: 'array{data: array{property_id: string}}')]
    #[Response(404, description: 'Bất động sản không khả dụng để lưu.')]
    public function store(Request $request, string $property): JsonResponse
    {
        Gate::allowIf($this->policy->write(...));
        $property = strtolower($property);
        $saved = $this->owned($request)->where('property_id', $property);
        if ($saved->exists()) {
            return $this->privateJson(['property_id' => $property]);
        }

        $inserted = DB::transaction(function () use ($request, $property): int {
            $target = DB::table('properties')->where('id', $property)->lock('for key share')->first(['id']);
            abort_if($target === null, 404);
            abort_unless(Listing::query()->publiclyVisible()->where('property_id', $property)->exists(), 404);

            return DB::table('favourite_properties')->insertOrIgnore([
                'user_id' => $request->user()->id,
                'property_id' => $property,
            ]);
        }, 3);

        return $this->privateJson(['property_id' => $property], $inserted === 1 ? 201 : 200);
    }

    #[Response(204, description: 'Đã bỏ lưu hoặc mục này chưa được lưu.')]
    public function destroy(Request $request, string $property): HttpResponse
    {
        Gate::allowIf($this->policy->write(...));
        $this->owned($request)->where('property_id', strtolower($property))->delete();

        return response()->noContent()->header('Cache-Control', 'private, no-store');
    }

    private function owned(Request $request): Builder
    {
        $userId = $request->user()->id;
        $expectedAccount = $request->header('X-Favourites-Account');
        abort_if($expectedAccount !== null && $expectedAccount !== $userId, 409, 'Tài khoản đã thay đổi. Vui lòng tải lại.');

        return DB::table('favourite_properties')->where('favourite_properties.user_id', $userId);
    }

    /** @param array<string, mixed> $data */
    private function privateJson(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }
}
