<?php

namespace Tests\Feature;

use App\Models\Listing;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class ListingReportsFlowsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-02 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function createAdminUser(): User
    {
        $admin = User::factory()->create();
        DB::table('users')->where('id', $admin->id)->update(['is_admin' => true]);

        return $admin->fresh();
    }

    /**
     * FR38-AC01: Authenticated user can report public listing synchronously without auto-hiding.
     */
    public function test_authenticated_user_can_report_public_listing_synchronously_without_auto_hiding(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();
        $admin = $this->createAdminUser();

        $response = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Chủ nhà yêu cầu cọc qua tài khoản lạ không đúng hợp đồng.',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.reason_code', 'FRAUD')
            ->assertJsonPath('data.status', 'OPEN')
            ->assertJsonPath('data.listing_id', $published->listingId);

        // Verify report persisted in DB
        $this->assertDatabaseHas('listing_reports', [
            'listing_id' => $published->listingId,
            'reporter_id' => $reporter->id,
            'reason_code' => 'FRAUD',
            'status' => 'OPEN',
        ]);

        // Verify notification outbox recorded for admin
        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'listing_report.created',
            'recipient_id' => $admin->id,
        ]);

        // Verify listing is NOT auto-hidden
        $listing = Listing::find($published->listingId);
        $this->assertNotNull($listing);
        $this->assertNull($listing->admin_suspended_at);
        $this->assertSame('PUBLISHED', $listing->publication_status);
    }

    /**
     * FR38-AC02: Guest cannot report, client cannot forge reporter or status.
     */
    public function test_guest_cannot_report_and_client_cannot_forge_reporter_or_status(): void
    {
        $published = PublicListingFixture::published();
        $fakeUser = User::factory()->create();

        // Guest cannot report
        $guestResponse = $this->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Test report',
        ]);
        $guestResponse->assertUnauthorized();

        // Authenticated user cannot forge reporter_id or status
        $actualReporter = User::factory()->create();
        $response = $this->actingAs($actualReporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reporter_id' => $fakeUser->id,
            'status' => 'RESOLVED',
            'reason_code' => 'HARMFUL',
            'description' => 'Nội dung bạo lực',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'OPEN');

        $this->assertDatabaseHas('listing_reports', [
            'listing_id' => $published->listingId,
            'reporter_id' => $actualReporter->id,
            'status' => 'OPEN',
        ]);
    }

    /**
     * FR38-AC03: Report requires valid reason_code and non-blank description.
     */
    public function test_report_requires_valid_reason_code_and_non_blank_description(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();

        // Invalid reason code
        $resInvalidReason = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'INVALID_CODE',
            'description' => 'Mô tả hợp lệ',
        ]);
        $resInvalidReason->assertStatus(422)
            ->assertJsonValidationErrors(['reason_code']);

        // Blank description
        $resBlankDesc = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => '   ',
        ]);
        $resBlankDesc->assertStatus(422)
            ->assertJsonValidationErrors(['description']);
    }

    /**
     * FR38-AC04: Duplicate active report from same reporter fails with conflict (409).
     */
    public function test_concurrent_duplicate_report_from_same_reporter_fails_with_conflict(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();

        $res1 = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Báo cáo lần đầu',
        ]);
        $res1->assertStatus(201);

        // Attempting to submit another active report for the same listing
        $res2 = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'MISLEADING',
            'description' => 'Báo cáo lần hai',
        ]);
        $res2->assertStatus(409)
            ->assertJsonPath('message', 'Bạn đã có một báo cáo đang được xử lý cho tin đăng này.');
    }

    /**
     * FR38-AC05: Cannot report listing that has been hidden or suspended.
     */
    public function test_cannot_report_listing_that_has_been_hidden_or_suspended(): void
    {
        $suspended = PublicListingFixture::published([
            'admin_suspended_at' => now(),
            'suspension_reason' => 'Đã bị đình chỉ',
        ]);
        $reporter = User::factory()->create();

        $resSuspended = $this->actingAs($reporter)->postJson("/api/v1/listings/{$suspended->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Báo cáo tin đã đình chỉ',
        ]);
        $resSuspended->assertStatus(404);

        $draft = PublicListingFixture::published([
            'publication_status' => 'DRAFT',
        ]);

        $resDraft = $this->actingAs($reporter)->postJson("/api/v1/listings/{$draft->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Báo cáo tin draft',
        ]);
        $resDraft->assertStatus(404);
    }

    /**
     * FR39-AC01: Admin can resolve report and atomically suspend listing with audit and outbox.
     */
    public function test_admin_can_resolve_report_and_atomically_suspend_listing_with_audit_and_outbox(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();
        $admin = $this->createAdminUser();

        $submitRes = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Lừa đảo tiền đặt cọc',
        ]);
        $reportId = $submitRes->json('data.id');

        $resolveRes = $this->actingAs($admin)->postJson("/api/v1/admin/listing-reports/{$reportId}/resolve", [
            'resolution_summary' => 'Xác minh có dấu hiệu lừa đảo. Đình chỉ tin đăng và hoàn tiền cho người thuê.',
            'internal_notes' => 'Tài khoản ngân hàng trùng với danh sách đen.',
            'suspend_listing' => true,
            'suspension_reason' => 'Vi phạm quy định chống lừa đảo đặt cọc.',
        ]);

        $resolveRes->assertOk()
            ->assertJsonPath('data.status', 'RESOLVED')
            ->assertJsonPath('data.listing.is_suspended', true);

        // Verify listing is suspended
        $listing = Listing::find($published->listingId);
        $this->assertNotNull($listing);
        $this->assertTrue($listing->isSuspended());
        $this->assertSame($admin->id, $listing->admin_suspended_by);

        // Verify Audit Logs
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'listing',
            'entity_id' => $published->listingId,
            'action' => 'listing.suspended',
            'actor_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'listing_report',
            'entity_id' => $reportId,
            'action' => 'listing_report.resolved',
            'actor_id' => $admin->id,
        ]);

        // Verify Notification Outbox for reporter
        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'listing_report.resolved',
            'recipient_id' => $reporter->id,
        ]);
    }

    /**
     * FR39-AC02: Admin decision requires resolution_summary.
     */
    public function test_admin_decision_requires_resolution_summary(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();
        $admin = $this->createAdminUser();

        $submitRes = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Mô tả hợp lệ',
        ]);
        $reportId = $submitRes->json('data.id');

        $resNoSummary = $this->actingAs($admin)->postJson("/api/v1/admin/listing-reports/{$reportId}/resolve", [
            'internal_notes' => 'Ghi chú nội bộ',
        ]);
        $resNoSummary->assertStatus(422)
            ->assertJsonValidationErrors(['resolution_summary']);
    }

    /**
     * FR39-AC03: Concurrent admin decisions yield one winner and second fails with 409.
     */
    public function test_concurrent_admin_decisions_yield_one_winner_and_second_fails_with_409(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();
        $admin1 = $this->createAdminUser();
        $admin2 = $this->createAdminUser();

        $submitRes = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Mô tả hợp lệ',
        ]);
        $reportId = $submitRes->json('data.id');

        // Admin 1 resolves
        $res1 = $this->actingAs($admin1)->postJson("/api/v1/admin/listing-reports/{$reportId}/resolve", [
            'resolution_summary' => 'Giải quyết bởi Admin 1',
        ]);
        $res1->assertOk();

        // Admin 2 tries to dismiss
        $res2 = $this->actingAs($admin2)->postJson("/api/v1/admin/listing-reports/{$reportId}/dismiss", [
            'resolution_summary' => 'Bác bỏ bởi Admin 2',
        ]);
        $res2->assertStatus(409)
            ->assertJsonPath('message', 'Báo cáo này đã được xử lý bởi một quản trị viên khác.');
    }

    /**
     * FR39-AC04: Owner publish cannot override admin suspension.
     */
    public function test_owner_publish_cannot_override_admin_suspension(): void
    {
        $published = PublicListingFixture::published();
        $admin = $this->createAdminUser();

        // Admin suspends
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$published->listingId}/suspend", [
            'reason' => 'Đình chỉ vi phạm nội quy',
        ])->assertOk();

        $listing = Listing::find($published->listingId);
        $this->assertNotNull($listing);
        $this->assertTrue($listing->isSuspended());

        // Attempt by owner or DB update without touching admin columns
        $listing->update(['publication_status' => 'PUBLISHED', 'title' => 'Cập nhật tiêu đề mới']);

        $refreshed = $listing->fresh();
        $this->assertNotNull($refreshed);
        $this->assertTrue($refreshed->isSuspended());
        $this->assertNotNull($refreshed->admin_suspended_at);
    }

    /**
     * FR72-AC01: Reporter can view own reports with sanitized outcome only.
     */
    public function test_reporter_can_view_own_reports_with_sanitized_outcome_only(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();
        $admin = $this->createAdminUser();

        $submitRes = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'MISLEADING',
            'description' => 'Thông tin phòng không đúng thực tế',
        ]);
        $reportId = $submitRes->json('data.id');

        // Admin resolves with internal notes
        $this->actingAs($admin)->postJson("/api/v1/admin/listing-reports/{$reportId}/resolve", [
            'resolution_summary' => 'Đã xác minh và yêu cầu chủ nhà sửa ảnh phòng.',
            'internal_notes' => 'INTERNAL NOTE: Bí mật nghiệp vụ quản trị không được để lộ',
        ])->assertOk();

        // Reporter views list
        $listRes = $this->actingAs($reporter)->getJson('/api/v1/tenant/reports');
        $listRes->assertOk()
            ->assertJsonPath('data.0.id', $reportId)
            ->assertJsonPath('data.0.status', 'RESOLVED')
            ->assertJsonPath('data.0.resolution_summary', 'Đã xác minh và yêu cầu chủ nhà sửa ảnh phòng.')
            ->assertJsonMissingPath('data.0.internal_notes')
            ->assertJsonMissingPath('data.0.reviewed_by');

        // Reporter views single report
        $singleRes = $this->actingAs($reporter)->getJson("/api/v1/tenant/reports/{$reportId}");
        $singleRes->assertOk()
            ->assertJsonPath('data.id', $reportId)
            ->assertJsonPath('data.resolution_summary', 'Đã xác minh và yêu cầu chủ nhà sửa ảnh phòng.')
            ->assertJsonMissingPath('data.internal_notes')
            ->assertJsonMissingPath('data.reviewed_by');
    }

    /**
     * FR72-AC02: Reporter cannot view other users' reports.
     */
    public function test_reporter_cannot_view_other_reports_and_internal_notes_are_never_exposed(): void
    {
        $published = PublicListingFixture::published();
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $submitRes = $this->actingAs($userA)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'OTHER',
            'description' => 'Báo cáo của User A',
        ]);
        $reportId = $submitRes->json('data.id');

        // User B cannot view User A's report
        $resUserB = $this->actingAs($userB)->getJson("/api/v1/tenant/reports/{$reportId}");
        $resUserB->assertStatus(404);
    }

    /**
     * FR72-AC03: Report submission is rate limited (10 requests per minute).
     */
    public function test_report_submission_is_rate_limited(): void
    {
        $reporter = User::factory()->create();

        for ($i = 0; $i < 10; $i++) {
            $p = PublicListingFixture::published();
            $res = $this->actingAs($reporter)->postJson("/api/v1/listings/{$p->listingId}/reports", [
                'reason_code' => 'FRAUD',
                'description' => 'Report number '.($i + 1),
            ]);
            $res->assertStatus(201);
        }

        // 11th request triggers rate limit
        $extra = PublicListingFixture::published();
        $resBlocked = $this->actingAs($reporter)->postJson("/api/v1/listings/{$extra->listingId}/reports", [
            'reason_code' => 'FRAUD',
            'description' => 'Blocked 11th report',
        ]);
        $resBlocked->assertStatus(429);
    }

    /**
     * FR72-AC04: Cannot submit duplicate report while previous is reviewing.
     */
    public function test_cannot_submit_duplicate_report_while_previous_is_reviewing(): void
    {
        $published = PublicListingFixture::published();
        $reporter = User::factory()->create();
        $admin = $this->createAdminUser();

        $submitRes = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'HARMFUL',
            'description' => 'Báo cáo đầu tiên',
        ]);
        $reportId = $submitRes->json('data.id');

        // Admin starts review (OPEN -> REVIEWING)
        $this->actingAs($admin)->postJson("/api/v1/admin/listing-reports/{$reportId}/start-review")->assertOk();

        // Reporter tries to report the same listing again while reviewing
        $resDup = $this->actingAs($reporter)->postJson("/api/v1/listings/{$published->listingId}/reports", [
            'reason_code' => 'HARMFUL',
            'description' => 'Báo cáo trùng lặp khi đang điều tra',
        ]);
        $resDup->assertStatus(409);
    }

    /**
     * FR78-AC01: Admin can suspend listing directly with reason and audit.
     */
    public function test_admin_can_suspend_listing_directly_with_reason_and_audit(): void
    {
        $published = PublicListingFixture::published();
        $admin = $this->createAdminUser();

        $res = $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$published->listingId}/suspend", [
            'reason' => 'Đình chỉ khẩn cấp do tranh chấp pháp lý mặt bằng.',
        ]);

        $res->assertOk()
            ->assertJsonPath('data.is_suspended', true)
            ->assertJsonPath('data.suspension_reason', 'Đình chỉ khẩn cấp do tranh chấp pháp lý mặt bằng.');

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'listing',
            'entity_id' => $published->listingId,
            'action' => 'listing.suspended',
            'actor_id' => $admin->id,
            'reason' => 'Đình chỉ khẩn cấp do tranh chấp pháp lý mặt bằng.',
        ]);
    }

    /**
     * FR78-AC02: Suspended listing is immediately hidden from public search and detail.
     */
    public function test_suspended_listing_is_immediately_hidden_from_public_search_and_detail(): void
    {
        $published = PublicListingFixture::published(['title' => 'Căn hộ view biển cao cấp']);
        $admin = $this->createAdminUser();

        // Before suspension: accessible via public detail & search
        $this->getJson("/api/v1/listings/{$published->listingId}")->assertOk();
        $searchResBefore = $this->getJson('/api/v1/listings?search=Căn hộ view biển');
        $searchResBefore->assertOk();
        $this->assertContains($published->listingId, collect($searchResBefore->json('data'))->pluck('id')->all());

        // Admin suspends
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$published->listingId}/suspend", [
            'reason' => 'Đình chỉ kiểm tra',
        ])->assertOk();

        // After suspension: public detail returns 404
        $this->getJson("/api/v1/listings/{$published->listingId}")->assertStatus(404);

        // Public search omits suspended listing
        $searchResAfter = $this->getJson('/api/v1/listings?search=Căn hộ view biển');
        $searchResAfter->assertOk();
        $this->assertNotContains($published->listingId, collect($searchResAfter->json('data'))->pluck('id')->all());
    }

    /**
     * FR78-AC03: Non-admin users cannot call suspension endpoint (CON-003: 404 response).
     */
    public function test_owner_cannot_clear_suspension_fields(): void
    {
        $published = PublicListingFixture::published();
        $normalUser = User::factory()->create();

        // Non-admin calling admin endpoint gets 404 per CON-003 Non-disclosure
        $res = $this->actingAs($normalUser)->postJson("/api/v1/admin/listings/{$published->listingId}/suspend", [
            'reason' => 'Thử đình chỉ trái phép',
        ]);
        $res->assertStatus(404);

        $resRestore = $this->actingAs($normalUser)->postJson("/api/v1/admin/listings/{$published->listingId}/restore", [
            'reason' => 'Thử khôi phục trái phép',
        ]);
        $resRestore->assertStatus(404);
    }

    /**
     * FR78-AC04: Admin restore clears suspension with audit and respects owner publication status.
     */
    public function test_admin_restore_clears_suspension_with_audit_and_respects_owner_publication_status(): void
    {
        $published = PublicListingFixture::published();
        $admin = $this->createAdminUser();

        // Suspend
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$published->listingId}/suspend", [
            'reason' => 'Tạm đình chỉ',
        ])->assertOk();

        // Restore
        $restoreRes = $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$published->listingId}/restore", [
            'reason' => 'Chủ nhà đã giải trình và bổ sung giấy phép hợp lệ.',
        ]);

        $restoreRes->assertOk()
            ->assertJsonPath('data.is_suspended', false);

        $listing = Listing::find($published->listingId);
        $this->assertNotNull($listing);
        $this->assertFalse($listing->isSuspended());
        $this->assertNull($listing->admin_suspended_at);
        $this->assertNull($listing->suspension_reason);

        // Verify audit log
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'listing',
            'entity_id' => $published->listingId,
            'action' => 'listing.restored',
            'actor_id' => $admin->id,
            'reason' => 'Chủ nhà đã giải trình và bổ sung giấy phép hợp lệ.',
        ]);

        // Listing is once again visible publicly
        $this->getJson("/api/v1/listings/{$published->listingId}")->assertOk();
    }

    /**
     * FR78-AC05: Suspended listing denies public access even if previously viewed.
     */
    public function test_suspended_listing_denies_public_access_even_if_previously_viewed(): void
    {
        $published = PublicListingFixture::published();
        $admin = $this->createAdminUser();

        // View 1
        $this->getJson("/api/v1/listings/{$published->listingId}")->assertOk();

        // Admin suspends
        $this->actingAs($admin)->postJson("/api/v1/admin/listings/{$published->listingId}/suspend", [
            'reason' => 'Tạm khóa',
        ])->assertOk();

        // View 2
        $this->getJson("/api/v1/listings/{$published->listingId}")->assertStatus(404);
    }
}
