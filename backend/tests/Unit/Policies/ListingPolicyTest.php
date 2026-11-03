<?php

namespace Tests\Unit\Policies;

use App\Models\User;
use App\Policies\ListingPolicy;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ListingPolicyTest extends TestCase
{
    #[DataProvider('accountPermissions')]
    public function test_current_account_permissions_control_listing_review(array $attributes, bool $allowed): void
    {
        $user = User::factory()->make($attributes);
        $policy = new ListingPolicy;

        $this->assertSame($allowed, $policy->viewAny($user));
        $this->assertSame($allowed, $policy->review($user));
    }

    public static function accountPermissions(): array
    {
        return [
            'active verified admin' => [['is_admin' => true], true],
            'normal member' => [['is_admin' => false], false],
            'unverified admin' => [['is_admin' => true, 'email_verified_at' => null], false],
            'suspended admin' => [['is_admin' => true, 'account_status' => 'SUSPENDED'], false],
        ];
    }
}
