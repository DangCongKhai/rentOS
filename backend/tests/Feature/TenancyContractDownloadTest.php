<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class TenancyContractDownloadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.supabase.url' => 'https://storage.example.test',
            'services.supabase.service_role_key' => 'test-service-role-key',
            'services.supabase.contracts.bucket' => 'contract-documents',
        ]);
    }

    public function test_owner_and_tenant_receive_a_short_lived_signed_url(): void
    {
        $case = $this->createPendingContract();
        $signedPath = "/object/sign/contract-documents/contracts/{$case['contract']->id}.pdf?token=test-token";

        Http::fake([
            'https://storage.example.test/storage/v1/object/sign/*' => Http::response([
                'signedURL' => $signedPath,
            ], 200),
        ]);

        $ownerUrl = "/api/v1/owner/tenancies/{$case['tenancy']->id}/contracts/{$case['contract']->id}/download";
        $tenantUrl = "/api/v1/tenant/tenancies/{$case['tenancy']->id}/contracts/{$case['contract']->id}/download";

        $this->actingAs($case['listing']->owner)->getJson($ownerUrl)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.contract_id', $case['contract']->id)
            ->assertJsonPath('data.version_number', 1)
            ->assertJsonPath('data.expires_in', 300)
            ->assertJsonPath('data.url', 'https://storage.example.test/storage/v1'.$signedPath)
            ->assertJsonMissingPath('data.document_path');

        $this->actingAs($case['tenant'])->getJson($tenantUrl)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.contract_id', $case['contract']->id)
            ->assertJsonPath('data.expires_in', 300);

        Http::assertSentCount(2);

        foreach (Http::recorded() as [$request]) {
            $this->assertSame('POST', $request->method());
            $this->assertStringContainsString(
                "/storage/v1/object/sign/contract-documents/contracts/{$case['contract']->id}.pdf",
                $request->url(),
            );
            $this->assertSame(300, (int) ($request->data()['expiresIn'] ?? 0));
        }
    }

    public function test_unrelated_user_cannot_request_a_contract_download(): void
    {
        $case = $this->createPendingContract();

        Http::fake();

        $this->actingAs(User::factory()->create())->getJson(
            "/api/v1/owner/tenancies/{$case['tenancy']->id}/contracts/{$case['contract']->id}/download",
        )->assertNotFound();

        Http::assertNothingSent();
    }

    /**
     * @return array{
     *     listing: PublishedListing,
     *     tenancy: object,
     *     contract: object,
     *     tenant: User
     * }
     */
    private function createPendingContract(): array
    {
        $listing = PublicListingFixture::published();
        $unitId = $listing->unitIds[0];
        $startDate = now()->addDays(30)->toDateString();
        $endDate = CarbonImmutable::parse($startDate)
            ->addMonthsNoOverflow(3)
            ->subDay()
            ->toDateString();

        PublicListingFixture::blockUnit($unitId, $startDate, $endDate);

        $tenancy = DB::table('tenancies')
            ->where('unit_id', $unitId)
            ->where('status', 'PENDING_CONFIRMATION')
            ->firstOrFail();

        $contract = DB::table('tenancy_contracts')
            ->where('tenancy_id', $tenancy->id)
            ->where('id', $tenancy->pending_contract_id)
            ->firstOrFail();

        return [
            'listing' => $listing,
            'tenancy' => $tenancy,
            'contract' => $contract,
            'tenant' => User::query()->findOrFail($tenancy->tenant_id),
        ];
    }
}
