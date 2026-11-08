<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

class OwnerRentalRequestsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $owner */
        $owner = $request->user();

        abort_unless($owner->canManageOwnerProducts(), 403);
        abort_if($owner->currentAccessToken() instanceof PersonalAccessToken, 403);

        $requests = DB::table('rental_requests as requests')
            ->join('listings', 'listings.id', '=', 'requests.listing_id')
            ->join('properties', 'properties.id', '=', 'listings.property_id')
            ->leftJoin('units as preferred_units', 'preferred_units.id', '=', 'requests.preferred_unit_id')
            ->leftJoin('tenancies', 'tenancies.rental_request_id', '=', 'requests.id')
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
                'listings.title as listing_title',
                'properties.name as property_name',
                'properties.city',
                'preferred_units.label as preferred_unit_label',
                'tenancies.id as tenancy_id',
            ])
            ->orderByDesc('requests.created_at')
            ->get();

        return response()->json(['data' => $requests]);
    }

    public function show(Request $request, string $rentalRequest): JsonResponse
    {
        /** @var User $owner */
        $owner = $request->user();

        abort_unless($owner->canManageOwnerProducts(), 403);
        abort_if($owner->currentAccessToken() instanceof PersonalAccessToken, 403);

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
        ]);
    }
}
