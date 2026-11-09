<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenancyContractDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_contract_download_routes_are_not_available(): void
    {
        $user = User::factory()->create();
        $tenancyId = '01a00000-0000-7000-8000-000000000001';
        $contractId = '01a00000-0000-7000-8000-000000000002';

        $this->actingAs($user)->getJson(
            "/api/v1/owner/tenancies/{$tenancyId}/contracts/{$contractId}/download",
        )->assertNotFound();

        $this->actingAs($user)->getJson(
            "/api/v1/tenant/tenancies/{$tenancyId}/contracts/{$contractId}/download",
        )->assertNotFound();
    }
}
