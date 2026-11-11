<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Listings\ListListingReviews;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminDashboardResource;
use App\Models\Listing;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class AdminDashboardController extends Controller
{
    public function __invoke(ListListingReviews $reviews): AdminDashboardResource
    {
        Gate::authorize('viewAny', Listing::class);
        $waiting = $reviews->query()->limit(3)->get();

        return new AdminDashboardResource([
            'pending_count' => $reviews->query()->count(),
            'oldest_submitted_at' => $waiting->first()?->submitted_at,
            'open_reports_count' => DB::table('listing_reports')->whereIn('status', ['OPEN', 'REVIEWING'])->count(),
            'suspended_count' => DB::table('listings')->whereNotNull('admin_suspended_at')->whereNull('archived_at')->count(),
            'waiting' => $waiting->map(fn (object $row): array => $reviews->summary($row))->all(),
            'activities' => DB::table('audit_logs as audit')->join('listings', 'listings.id', '=', 'audit.entity_id')->leftJoin('users as actors', 'actors.id', '=', 'audit.actor_id')->where('audit.entity_type', 'listing')->orderByDesc('audit.created_at')->orderByDesc('audit.id')->limit(5)->get(['audit.id', 'audit.action', 'actors.name as actor_name', 'listings.title', 'listings.id as listing_id', 'audit.reason', 'audit.created_at'])->map(fn (object $row): array => (array) $row)->all(),
        ]);
    }
}
