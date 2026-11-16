<?php

namespace App\Policies;

use App\Models\ListingReport;
use App\Models\User;

class ListingReportPolicy
{
    /**
     * Determine whether the user can view the listing report.
     */
    public function view(User $user, ListingReport $report): bool
    {
        return $user->isAdmin() || $report->reporter_id === $user->id;
    }

    /**
     * Determine whether the user can create a listing report.
     */
    public function create(User $user): bool
    {
        return $user->account_status === 'ACTIVE';
    }

    /**
     * Determine whether the user can investigate/resolve/dismiss reports.
     */
    public function investigate(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can suspend or restore listings directly.
     */
    public function suspendListing(User $user): bool
    {
        return $user->isAdmin();
    }
}
