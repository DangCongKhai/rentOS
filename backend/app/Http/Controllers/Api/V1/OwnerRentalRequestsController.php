<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\RentalRequests\CloseRentalRequest;
use App\Http\Controllers\Controller;
use App\Http\Requests\RejectRentalRequest;
use App\Http\Resources\OwnerRentalRequestDetailResource;
use App\Http\Resources\OwnerRentalRequestResource;
use App\Models\RentalRequest;
use App\Models\User;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class OwnerRentalRequestsController extends Controller
{
    #[Response(200, description: 'Yêu cầu thuộc bất động sản của chủ nhà hiện tại.', type: 'array{data: array{items: list<OwnerRentalRequestResource>, counts: array{PENDING: int, ACCEPTED: int, REJECTED: int, WITHDRAWN: int}, page: int, last_page: int}}')]
    #[Response(403, description: 'Tài khoản hoặc phiên không có quyền xem hộp thư.', type: 'array{message: string}')]
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewOwnerInbox', RentalRequest::class);
        $input = $request->validate([
            'status' => ['sometimes', Rule::in(['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
        ]);
        /** @var User $owner */
        $owner = $request->user();
        $status = $input['status'] ?? 'PENDING';
        $byStatus = RentalRequest::query()->forOwner($owner)->toBase()
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $counts = [
            'PENDING' => (int) $byStatus->get('PENDING', 0),
            'ACCEPTED' => (int) $byStatus->get('ACCEPTED', 0),
            'REJECTED' => (int) $byStatus->get('REJECTED', 0),
            'WITHDRAWN' => (int) $byStatus->get('WITHDRAWN', 0),
        ];
        $results = $this->readQuery($owner)->where('rental_requests.status', $status)
            ->orderBy('rental_requests.created_at')->orderBy('rental_requests.id')
            ->paginate(15, page: (int) ($input['page'] ?? 1));

        return response()->json(['data' => [
            'items' => OwnerRentalRequestResource::collection($results->items())->resolve($request),
            'counts' => $counts,
            'page' => $results->currentPage(),
            'last_page' => $results->lastPage(),
        ]])->header('Cache-Control', 'private, no-store');
    }

    #[Response(403, description: 'Tài khoản hoặc phiên không có quyền xem hộp thư.', type: 'array{message: string}')]
    #[Response(404, description: 'Không tìm thấy yêu cầu thuộc bất động sản của chủ nhà.', type: 'array{message: string}')]
    public function show(Request $request, string $rentalRequest): JsonResponse
    {
        Gate::authorize('viewOwnerInbox', RentalRequest::class);
        /** @var User $owner */
        $owner = $request->user();
        $item = $this->readQuery($owner)
            ->addSelect('listings.property_id', 'rental_requests.preferred_unit_id', 'rental_requests.updated_at', 'rental_requests.message')
            ->findOrFail($rentalRequest);
        $this->loadAvailability($item);

        return (new OwnerRentalRequestDetailResource($item))->response()->header('Cache-Control', 'private, no-store');
    }

    #[Response(204, description: 'Đã từ chối yêu cầu hoặc phát lại cùng thao tác.')]
    #[Response(403, description: 'Tài khoản hoặc phiên không có quyền từ chối.', type: 'array{message: string}')]
    #[Response(404, description: 'Không tìm thấy yêu cầu thuộc bất động sản của chủ nhà.', type: 'array{message: string}')]
    #[Response(409, description: 'Yêu cầu đã thay đổi hoặc mã thao tác đã được dùng.', type: 'array{message: string}')]
    #[Response(419, description: 'Mã CSRF không hợp lệ hoặc đã hết hạn.', type: 'array{message: string}')]
    public function reject(RejectRentalRequest $request, string $rentalRequest, CloseRentalRequest $close): HttpResponse
    {
        $input = $request->validated();
        $close->reject($request->user(), strtolower($rentalRequest), $input['expected_updated_at'], $input['client_operation_id'], $input['reason']);

        return response()->noContent()->header('Cache-Control', 'private, no-store');
    }

    #[Response(403, description: 'Tài khoản hoặc phiên không có quyền xem hộp thư.', type: 'array{message: string}')]
    #[Response(404, description: 'Không tìm thấy yêu cầu thuộc bất động sản của chủ nhà.', type: 'array{message: string}')]
    public function proposalContext(Request $request, string $rentalRequest): JsonResponse
    {
        Gate::authorize('viewOwnerInbox', RentalRequest::class);
        /** @var User $owner */
        $owner = $request->user();
        $rentalRequestData = DB::table('rental_requests as requests')
            ->join('listings', 'listings.id', '=', 'requests.listing_id')
            ->join('properties', 'properties.id', '=', 'listings.property_id')
            ->leftJoin('units as preferred_units', 'preferred_units.id', '=', 'requests.preferred_unit_id')
            ->where('requests.id', $rentalRequest)
            ->where('properties.owner_id', $owner->id)
            ->select([
                'requests.id',
                'requests.status',
                'requests.desired_move_in_date',
                'requests.desired_end_date',
                'requests.message',
                'requests.contact_name',
                'requests.contact_phone',
                'requests.created_at',
                'requests.closed_at',
                'requests.outcome_reason',
                'requests.preferred_unit_id',
                'preferred_units.label as preferred_unit_label',
                'listings.id as listing_id',
                'listings.title as listing_title',
                'properties.id as property_id',
                'properties.name as property_name',
                'properties.city',
                'properties.policies',
            ])
            ->first();

        abort_if($rentalRequestData === null, 404);

        $unitRows = DB::table('units')
            ->where('property_id', $rentalRequestData->property_id)
            ->whereNull('archived_at')
            ->orderBy('label')
            ->get([
                'id',
                'label',
                'operational_status',
                'advertised_monthly_rent',
                'deposit',
                'minimum_rental_months',
                'policy_overrides',
            ]);
        $overlappingUnitIds = DB::table('tenancies')
            ->whereIn('unit_id', $unitRows->pluck('id'))
            ->whereIn('status', ['PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE'])
            ->whereDate('blocked_start_date', '<=', $rentalRequestData->desired_end_date)
            ->whereDate('blocked_end_date', '>=', $rentalRequestData->desired_move_in_date)
            ->pluck('unit_id')
            ->flip();
        $units = $unitRows->map(static function (object $unit) use ($overlappingUnitIds): array {
            return [
                'id' => $unit->id,
                'label' => $unit->label,
                'operational_status' => $unit->operational_status,
                'monthly_rent' => $unit->advertised_monthly_rent,
                'deposit_amount' => $unit->deposit,
                'minimum_rental_months' => $unit->minimum_rental_months,
                'policy_overrides' => json_decode($unit->policy_overrides ?? '{}'),
                'has_date_conflict' => $overlappingUnitIds->has($unit->id),
            ];
        });

        return response()->json([
            'data' => [
                'request' => $rentalRequestData,
                'property_policies' => json_decode($rentalRequestData->policies ?? '{}'),
                'units' => $units,
            ],
        ])->header('Cache-Control', 'private, no-store');
    }

    /** @return Builder<RentalRequest> */
    private function readQuery(User $owner): Builder
    {
        return RentalRequest::query()->forOwner($owner)
            ->join('listings', 'listings.id', '=', 'rental_requests.listing_id')
            ->leftJoin('units', 'units.id', '=', 'rental_requests.preferred_unit_id')
            ->select([
                'rental_requests.id', 'rental_requests.contact_name', 'rental_requests.contact_phone',
                'rental_requests.desired_move_in_date', 'rental_requests.desired_end_date',
                'rental_requests.status', 'rental_requests.outcome_reason', 'rental_requests.created_at', 'rental_requests.closed_at',
                'listings.title as listing_title', 'units.label as unit_label',
            ]);
    }

    private function loadAvailability(RentalRequest $item): void
    {
        $item->setAttribute('preferred_unit_available', null)->setAttribute('alternative_units', []);
        if ($item->status !== 'PENDING') {
            return;
        }

        $units = DB::table('units')->where('property_id', $item->property_id)
            ->whereNull('archived_at')->where('operational_status', 'READY')->where('is_marketed', true)
            ->whereNotExists(function (QueryBuilder $query) use ($item): void {
                $query->selectRaw('1')->from('tenancies')
                    ->whereColumn('tenancies.unit_id', 'units.id')
                    ->whereIn('tenancies.status', ['PENDING_CONFIRMATION', 'CONFIRMED', 'ACTIVE'])
                    ->where('tenancies.blocked_start_date', '<=', $item->desired_end_date)
                    ->where('tenancies.blocked_end_date', '>=', $item->desired_move_in_date);
            })
            ->orderBy('label')->orderBy('id')->get(['id', 'label', 'advertised_monthly_rent']);
        $preferredId = $item->preferred_unit_id;
        $item->setAttribute('preferred_unit_available', $preferredId === null ? null : $units->contains('id', $preferredId));
        $item->setAttribute('alternative_units', $units->reject(fn (object $unit): bool => $unit->id === $preferredId)
            ->map(fn (object $unit): array => ['id' => $unit->id, 'label' => $unit->label, 'monthly_rent' => (string) $unit->advertised_monthly_rent])
            ->values()->all());
    }
}
