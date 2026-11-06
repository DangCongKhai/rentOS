<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\RentalRequests\SubmitRentalRequest;
use App\Actions\RentalRequests\WithdrawRentalRequest as WithdrawRentalRequestAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRentalRequest;
use App\Http\Requests\WithdrawRentalRequest;
use App\Http\Resources\SubmittedRentalRequestResource;
use App\Http\Resources\TenantRentalRequestDetailResource;
use App\Http\Resources\TenantRentalRequestResource;
use App\Models\RentalRequest;
use App\Models\User;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TenantRentalRequestsController extends Controller
{
    #[Response(200, description: 'Yêu cầu của tài khoản hiện tại và số lượng theo trạng thái.', type: 'array{data: array{items: list<TenantRentalRequestResource>, counts: array{all: int, pending: int, accepted: int, closed: int}, page: int, last_page: int}}')]
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', RentalRequest::class);
        $input = $request->validate([
            'filter' => ['sometimes', Rule::in(['all', 'pending', 'accepted', 'closed'])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
        ]);
        /** @var User $tenant */
        $tenant = $request->user();
        $byStatus = RentalRequest::query()->where('tenant_id', $tenant->id)->toBase()
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $counts = [
            'all' => (int) $byStatus->sum(),
            'pending' => (int) $byStatus->get('PENDING', 0),
            'accepted' => (int) $byStatus->get('ACCEPTED', 0),
            'closed' => (int) $byStatus->get('WITHDRAWN', 0) + (int) $byStatus->get('REJECTED', 0),
        ];
        $statuses = match ($input['filter'] ?? 'all') {
            'pending' => ['PENDING'],
            'accepted' => ['ACCEPTED'],
            'closed' => ['WITHDRAWN', 'REJECTED'],
            default => ['PENDING', 'ACCEPTED', 'WITHDRAWN', 'REJECTED'],
        };
        $results = $this->readQuery($tenant)
            ->whereIn('rental_requests.status', $statuses)
            ->orderByDesc('rental_requests.created_at')->orderByDesc('rental_requests.id')
            ->paginate(15, page: (int) ($input['page'] ?? 1));

        return response()->json(['data' => [
            'items' => TenantRentalRequestResource::collection($results->items())->resolve($request),
            'counts' => $counts,
            'page' => $results->currentPage(),
            'last_page' => $results->lastPage(),
        ]])->header('Cache-Control', 'private, no-store');
    }

    #[Response(404, description: 'Không tìm thấy yêu cầu của người thuê.', type: 'array{message: string}')]
    public function show(Request $request, string $rentalRequest): JsonResponse
    {
        Gate::authorize('viewAny', RentalRequest::class);
        /** @var User $tenant */
        $tenant = $request->user();
        $item = $this->readQuery($tenant)
            ->addSelect('rental_requests.contact_name', 'rental_requests.contact_phone', 'rental_requests.message')
            ->findOrFail($rentalRequest);
        Gate::authorize('view', $item);

        return (new TenantRentalRequestDetailResource($item))->response()->header('Cache-Control', 'private, no-store');
    }

    #[Response(204, description: 'Đã rút yêu cầu hoặc phát lại cùng thao tác.')]
    #[Response(403, description: 'Tài khoản hoặc phiên không có quyền rút yêu cầu.', type: 'array{message: string}')]
    #[Response(404, description: 'Không tìm thấy yêu cầu của người thuê.', type: 'array{message: string}')]
    #[Response(409, description: 'Yêu cầu hoặc phiên bản đã thay đổi.', type: 'array{message: string}')]
    #[Response(419, description: 'Mã CSRF không hợp lệ hoặc đã hết hạn.', type: 'array{message: string}')]
    public function withdraw(WithdrawRentalRequest $request, string $rentalRequest, WithdrawRentalRequestAction $withdraw): HttpResponse
    {
        $input = $request->validated();
        $withdraw->handle(
            $request->user(),
            strtolower($rentalRequest),
            $input['expected_updated_at'],
            $input['client_operation_id'],
            $input['reason'] ?? null,
        );

        return response()->noContent()->header('Cache-Control', 'private, no-store');
    }

    #[Response(201, description: 'Yêu cầu thuê đã được lưu.', type: 'array{data: array{id: string, status: "PENDING"}}')]
    #[Response(200, description: 'Kết quả của lần gửi trước với cùng mã thao tác.', type: 'array{data: array{id: string, status: "PENDING"|"ACCEPTED"|"REJECTED"|"WITHDRAWN"}}')]
    #[Response(409, description: 'Yêu cầu đang chờ đã tồn tại hoặc mã thao tác trùng với nội dung khác.', type: 'array{message: string}')]
    #[Response(419, description: 'Phiên bảo mật đã hết hạn hoặc mã CSRF không hợp lệ.', type: 'array{message: string}')]
    public function store(StoreRentalRequest $request, SubmitRentalRequest $submit): JsonResponse
    {
        $result = $submit->handle($request->user(), $request->validated());

        return (new SubmittedRentalRequestResource($result))->response()
            ->setStatusCode($result['created'] ? 201 : 200)
            ->header('Cache-Control', 'private, no-store');
    }

    /** @return Builder<RentalRequest> */
    private function readQuery(User $tenant): Builder
    {
        return RentalRequest::query()->where('rental_requests.tenant_id', $tenant->id)
            ->join('listings', 'listings.id', '=', 'rental_requests.listing_id')
            ->join('properties', 'properties.id', '=', 'listings.property_id')
            ->leftJoin('units', 'units.id', '=', 'rental_requests.preferred_unit_id')
            ->leftJoin('tenancies', function (JoinClause $join): void {
                $join->on('tenancies.rental_request_id', '=', 'rental_requests.id')
                    ->on('tenancies.tenant_id', '=', 'rental_requests.tenant_id');
            })
            ->select([
                'rental_requests.id', 'rental_requests.tenant_id', 'rental_requests.desired_move_in_date',
                'rental_requests.desired_end_date', 'rental_requests.status', 'rental_requests.updated_at',
                'rental_requests.outcome_reason', 'rental_requests.created_at', 'rental_requests.closed_at',
                'listings.title as listing_title', 'properties.ward', 'properties.city', 'units.label as unit_label',
                'tenancies.id as tenancy_id', 'tenancies.status as tenancy_status', 'tenancies.confirmation_expires_at',
            ]);
    }
}
