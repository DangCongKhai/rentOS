<?php

namespace Tests\Feature;

use App\Actions\Tenancies\ReadTenancyTimeline;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\Support\PublicListingFixture;
use Tests\Support\PublishedListing;
use Tests\TestCase;

class TenancyTimelineReadTest extends TestCase
{
    use RefreshDatabase;

    public function test_participants_can_read_pending_then_current_agreement_without_storage_path(): void
    {
        $case = $this->createPendingTenancy(false);
        $reader = app(ReadTenancyTimeline::class);

        $ownerTimeline = $reader->handle($case['listing']->owner, $case['tenancy']->id);
        $tenantTimeline = $reader->handle($case['tenant'], $case['tenancy']->id);

        $this->assertSame('PENDING_CONFIRMATION', $ownerTimeline['tenancy']->status);
        $this->assertSame('ACCEPTED', $ownerTimeline['rental_request']->status);
        $this->assertSame($case['contract']->id, $ownerTimeline['pending_contract']->id);
        $this->assertNull($ownerTimeline['current_agreement']);
        $this->assertCount(1, $ownerTimeline['contracts']);
        $this->assertFalse(property_exists($ownerTimeline['contracts'][0], 'document_path'));
        $this->assertSame($case['tenancy']->id, $tenantTimeline['tenancy']->id);

        $this->actingAs($case['tenant'])->postJson(
            "/api/v1/tenant/tenancies/{$case['tenancy']->id}/contracts/{$case['contract']->id}/confirm",
            [
                'client_operation_id' => (string) Str::uuid(),
                'document_sha256' => $case['contract']->document_sha256,
            ],
        )->assertOk();

        $confirmedTimeline = $reader->handle(
            $case['tenant'],
            $case['tenancy']->id,
        );

        $this->assertNull($confirmedTimeline['pending_contract']);
        $this->assertSame(
            $case['contract']->id,
            $confirmedTimeline['current_agreement']->id,
        );
        $this->assertSame(
            $case['contract']->id,
            $confirmedTimeline['tenancy']->latest_confirmed_contract_id,
        );
    }

    public function test_future_agreement_is_not_current_and_unrelated_user_cannot_read_timeline(): void
    {
        $case = $this->createPendingTenancy(true);

        $this->actingAs($case['tenant'])->postJson(
            "/api/v1/tenant/tenancies/{$case['tenancy']->id}/contracts/{$case['contract']->id}/confirm",
            [
                'client_operation_id' => (string) Str::uuid(),
                'document_sha256' => $case['contract']->document_sha256,
            ],
        )->assertOk();

        $reader = app(ReadTenancyTimeline::class);
        $timeline = $reader->handle($case['tenant'], $case['tenancy']->id);

        $this->assertNull($timeline['current_agreement']);
        $this->assertCount(1, $timeline['upcoming_agreements']);
        $this->assertSame(
            $case['contract']->id,
            $timeline['upcoming_agreements'][0]->id,
        );

        $this->expectException(NotFoundHttpException::class);

        $reader->handle(
            User::factory()->create(),
            $case['tenancy']->id,
        );
    }

    /**
     * @return array{
     *     listing: PublishedListing,
     *     tenancy: object,
     *     contract: object,
     *     tenant: User
     * }
     */
    private function createPendingTenancy(bool $startInFuture): array
    {
        $listing = PublicListingFixture::published();
        $unitId = $listing->unitIds[0];

        $startDate = $startInFuture
            ? now()->addDays(30)->toDateString()
            : now()->subDay()->toDateString();

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
