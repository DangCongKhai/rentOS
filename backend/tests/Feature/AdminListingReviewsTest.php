<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\CreatesListingReviewPackages;
use Tests\Support\EnforcingCsrfMiddleware;
use Tests\TestCase;

class AdminListingReviewsTest extends TestCase
{
    use CreatesListingReviewPackages, RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertReviewDatabaseIsIsolated();
    }

    public function test_guest_gets_401_without_private_review_data(): void
    {
        $this->getJson('/api/v1/admin/listing-reviews')->assertUnauthorized()->assertJsonMissingPath('data');
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized()->assertJsonMissingPath('data');
    }

    #[DataProvider('protectedEndpoints')]
    public function test_normal_user_gets_403_from_every_review_endpoint(string $method, string $suffix): void
    {
        $package = $this->createReviewPackage();
        $member = User::factory()->create();
        $path = str_replace('{listing}', $package['listing_id'], $suffix);

        $this->actingAs($member, 'web')->json($method, '/api/v1/admin/'.$path, [])->assertForbidden();

        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
    }

    public static function protectedEndpoints(): array
    {
        return ['queue' => ['GET', 'listing-reviews'], 'detail' => ['GET', 'listing-reviews/{listing}'], 'approve' => ['POST', 'listing-reviews/{listing}/approve'], 'reject' => ['POST', 'listing-reviews/{listing}/reject'], 'dashboard' => ['GET', 'dashboard']];
    }

    #[DataProvider('ineligibleAdmins')]
    public function test_inactive_or_unverified_admin_gets_403(array $attributes): void
    {
        $admin = User::factory()->create(['is_admin' => true, ...$attributes]);

        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/listing-reviews')->assertForbidden();
    }

    public static function ineligibleAdmins(): array
    {
        return ['suspended' => [['account_status' => 'SUSPENDED']], 'unverified' => [['email_verified_at' => null]]];
    }

    public function test_real_admin_personal_token_gets_403_with_all_allowed_abilities(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $token = $admin->createToken('Token cannot administer', ['account:read', 'favourites:read', 'favourites:write'], now()->addHour())->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/admin/listing-reviews')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/admin/listing-reviews/'.Str::uuid().'/approve', [])->assertForbidden();
    }

    public function test_admin_privilege_revoked_after_loading_returns_403_before_decision(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        DB::table('users')->where('id', $admin->id)->update(['is_admin' => false]);

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertForbidden();

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'PENDING']);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_queue_contains_only_initial_pending_live_packages_oldest_first_and_paginates(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $newest = $this->createReviewPackage(['submitted_at' => '2026-10-29 09:00:00+00']);
        $oldest = $this->createReviewPackage(['submitted_at' => '2026-10-27 09:00:00+00']);
        $middle = $this->createReviewPackage(['submitted_at' => '2026-10-28 09:00:00+00']);
        $draft = $this->createReviewPackage();
        DB::table('listings')->where('id', $draft['listing_id'])->update(['moderation_status' => 'DRAFT']);
        $rejected = $this->createReviewPackage();
        DB::table('listings')->where('id', $rejected['listing_id'])->update(['moderation_status' => 'REJECTED', 'review_reason' => 'Sửa lại địa chỉ', 'reviewed_by' => $admin->id, 'reviewed_at' => now()]);
        $approved = $this->createReviewPackage();
        DB::table('listings')->where('id', $approved['listing_id'])->update(['moderation_status' => 'APPROVED', 'approved_content_revision' => 1, 'reviewed_by' => $admin->id, 'reviewed_at' => now()]);
        $this->createReviewPackage(['archived_at' => '2026-10-29 10:00:00+00']);

        $response = $this->actingAs($admin, 'web')->getJson('/api/v1/admin/listing-reviews?per_page=2');

        $response->assertOk()->assertJsonPath('meta.total', 3)->assertJsonCount(2, 'data')->assertJsonPath('data.0.id', $oldest['listing_id'])->assertJsonPath('data.1.id', $middle['listing_id']);
        $this->getJson('/api/v1/admin/listing-reviews?per_page=2&page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $newest['listing_id']);
    }

    #[DataProvider('searchInputs')]
    public function test_queue_searches_title_or_owner_without_vietnamese_accents(string $search): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $matching = $this->createReviewPackage();
        $this->createReviewPackage(['title' => 'Nhà nguyên căn An Khê'], User::factory()->create(['name' => 'Quân']));

        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/listing-reviews?q='.urlencode($search))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $matching['listing_id']);
    }

    public static function searchInputs(): array
    {
        return ['title without accents' => ['my khe'], 'owner case and spaces' => [' HOA '], 'Vietnamese title' => ['Mỹ Khê']];
    }

    #[DataProvider('literalSearches')]
    public function test_queue_treats_sql_wildcards_as_literal_search_text(string $search): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $this->createReviewPackage();

        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/listing-reviews?q='.urlencode($search))->assertOk()->assertJsonCount(0, 'data');
    }

    public static function literalSearches(): array
    {
        return ['percent' => ['%'], 'underscore' => ['_'], 'SQL text' => ["' OR 1=1 --"]];
    }

    public function test_detail_contains_the_complete_package_and_only_selected_live_media(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $unselected = (string) Str::uuid();
        $this->insertReviewMedia($package['property_id'], $unselected, $package['owner']->id, selected: false);

        $response = $this->actingAs($admin, 'web')->getJson($this->detailPath($package['listing_id']));

        $response->assertOk()->assertJsonPath('data.id', $package['listing_id'])->assertJsonPath('data.moderation_status', 'PENDING')->assertJsonPath('data.publication_status', 'DRAFT')->assertJsonPath('data.property.id', $package['property_id'])->assertJsonPath('data.owner.id', $package['owner']->id)->assertJsonCount(1, 'data.units')->assertJsonCount(2, 'data.media')->assertJsonMissingPath('data.owner.password')->assertJsonMissingPath('data.owner.remember_token');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $response->json('data.snapshot_token'));
        $this->assertNotContains($unselected, array_column($response->json('data.media'), 'id'));
        $this->assertSame($response->json('data.snapshot_token'), $this->getJson($this->detailPath($package['listing_id']))->json('data.snapshot_token'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_approval_records_server_metadata_and_side_effects_without_publishing(): void
    {
        $this->freezeTime();
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertOk()->assertJsonPath('data.moderation_status', 'APPROVED')->assertJsonPath('data.publication_status', 'DRAFT');

        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'APPROVED', 'publication_status' => 'DRAFT', 'reviewed_by' => $admin->id, 'approved_content_revision' => 1]);
        $this->assertNotNull(DB::table('listings')->where('id', $package['listing_id'])->value('reviewed_at'));
        $this->assertDatabaseHas('audit_logs', ['entity_type' => 'listing', 'entity_id' => $package['listing_id'], 'action' => 'listing.approved', 'actor_id' => $admin->id]);
        $this->assertDatabaseHas('notification_outbox', ['recipient_id' => $package['owner']->id, 'event_type' => 'listing.approved', 'status' => 'PENDING']);
        $this->assertDatabaseHas('idempotency_records', ['actor_id' => $admin->id, 'client_operation_id' => $payload['client_operation_id'], 'action' => 'listing.approve']);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
    }

    #[DataProvider('incompletePackages')]
    public function test_approval_of_an_incomplete_loaded_package_returns_409_without_writes(string $table, string $idKey, array $changes): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        DB::table($table)->where('id', $package[$idKey])->update($changes);
        $payload = $this->decisionPayload($admin, $package['listing_id']);

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertConflict();

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'PENDING', 'reviewed_by' => null]);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
        $this->assertDatabaseCount('idempotency_records', 0);
    }

    public static function incompletePackages(): array
    {
        return [
            'missing address' => ['properties', 'property_id', ['address_line' => '']],
            'unselected shared cover' => ['property_media', 'shared_media_id', ['is_selected_for_listing' => false]],
            'unselected unit photo' => ['property_media', 'unit_media_id', ['is_selected_for_listing' => false]],
            'unit under maintenance' => ['units', 'unit_id', ['operational_status' => 'MAINTENANCE']],
            'undecided policies' => ['properties', 'property_id', ['policies' => '{"schema_version":1,"pets":null,"smoking":null,"shared_rules":[]}']],
        ];
    }

    public function test_incomplete_package_can_still_be_rejected_with_a_reason(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        DB::table('property_media')->where('id', $package['unit_media_id'])->update(['is_selected_for_listing' => false]);
        $payload = [...$this->decisionPayload($admin, $package['listing_id']), 'reason' => 'Bổ sung ảnh riêng cho căn đang quảng cáo.'];

        $this->postJson($this->detailPath($package['listing_id']).'/reject', $payload)->assertOk()->assertJsonPath('data.moderation_status', 'REJECTED');

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'REJECTED', 'review_reason' => $payload['reason']]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
    }

    #[DataProvider('invalidReasons')]
    public function test_invalid_rejection_reason_returns_422_without_writing(mixed $reason): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = [...$this->decisionPayload($admin, $package['listing_id']), 'reason' => $reason];

        $this->postJson($this->detailPath($package['listing_id']).'/reject', $payload)->assertUnprocessable()->assertJsonValidationErrors('reason');

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'PENDING', 'reviewed_by' => null]);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
        $this->assertDatabaseCount('idempotency_records', 0);
    }

    public static function invalidReasons(): array
    {
        return ['null' => [null], 'empty' => [''], 'spaces' => [" \n\t "], 'array' => [[]], 'too long' => [str_repeat('x', 1001)]];
    }

    public function test_rejection_trims_reason_and_idempotent_retry_creates_one_outcome(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = [...$this->decisionPayload($admin, $package['listing_id']), 'reason' => '  Bổ sung địa chỉ chính xác.  '];

        $this->postJson($this->detailPath($package['listing_id']).'/reject', $payload)->assertOk()->assertJsonPath('data.review_reason', 'Bổ sung địa chỉ chính xác.');
        $this->postJson($this->detailPath($package['listing_id']).'/reject', [...$payload, 'reason' => 'Bổ sung địa chỉ chính xác.'])->assertOk();

        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'REJECTED', 'publication_status' => 'DRAFT', 'review_reason' => 'Bổ sung địa chỉ chính xác.', 'reviewed_by' => $admin->id]);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    public function test_same_operation_id_with_changed_payload_returns_409(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = [...$this->decisionPayload($admin, $package['listing_id']), 'reason' => 'Sai địa chỉ'];
        $this->postJson($this->detailPath($package['listing_id']).'/reject', $payload)->assertOk();

        $this->postJson($this->detailPath($package['listing_id']).'/reject', [...$payload, 'reason' => 'Sai ảnh'])->assertConflict();

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'review_reason' => 'Sai địa chỉ']);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
    }

    public function test_same_operation_id_reused_for_another_listing_returns_409(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $first = $this->createReviewPackage();
        $second = $this->createReviewPackage();
        $firstPayload = $this->decisionPayload($admin, $first['listing_id']);
        $secondPayload = [...$this->decisionPayload($admin, $second['listing_id']), 'client_operation_id' => $firstPayload['client_operation_id']];
        $this->postJson($this->detailPath($first['listing_id']).'/approve', $firstPayload)->assertOk();

        $this->postJson($this->detailPath($second['listing_id']).'/approve', $secondPayload)->assertConflict();

        $this->assertDatabaseHas('listings', ['id' => $second['listing_id'], 'moderation_status' => 'PENDING']);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    public function test_dashboard_pending_count_and_recent_activity_refresh_after_a_decision(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $first = $this->createReviewPackage();
        $this->createReviewPackage();
        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.pending_count', 2);
        $payload = $this->decisionPayload($admin, $first['listing_id']);
        $this->postJson($this->detailPath($first['listing_id']).'/approve', $payload)->assertOk();

        $response = $this->getJson('/api/v1/admin/dashboard');

        $response->assertOk()->assertJsonPath('data.pending_count', 1)->assertJsonCount(1, 'data.waiting')
            ->assertJsonPath('data.activities.0.listing_id', $first['listing_id'])->assertJsonPath('data.activities.0.action', 'listing.approved');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_an_opposite_decision_returns_409_without_overwriting_approval(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertOk();

        $this->postJson($this->detailPath($package['listing_id']).'/reject', [...$payload, 'client_operation_id' => (string) Str::uuid(), 'reason' => 'Không được ghi đè'])->assertConflict();

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'APPROVED']);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
    }

    #[DataProvider('staleChanges')]
    public function test_reviewed_content_change_returns_409_without_side_effects(string $table, string $idKey, array $attributes): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        DB::table($table)->where('id', $package[$idKey])->update($attributes);

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertConflict();

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'PENDING', 'reviewed_by' => null]);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
        $this->assertDatabaseCount('idempotency_records', 0);
    }

    public static function staleChanges(): array
    {
        return [
            'listing title' => ['listings', 'listing_id', ['title' => 'Nội dung chưa được xem']],
            'property name' => ['properties', 'property_id', ['name' => 'Tên đã thay đổi']],
            'unit rent' => ['units', 'unit_id', ['advertised_monthly_rent' => 4500000]],
            'selected media caption' => ['property_media', 'unit_media_id', ['caption' => 'Ảnh đã sửa']],
            'selected media bytes' => ['property_media', 'unit_media_id', ['sha256' => str_repeat('b', 64)]],
            'property policies' => ['properties', 'property_id', ['policies' => '{"schema_version":1,"pets":"ALLOWED","smoking":"NOT_ALLOWED","shared_rules":[]}']],
            'property amenities' => ['properties', 'property_id', ['shared_amenities' => '{"schema_version":1,"standard":{},"custom":["Bãi xe mới"]}']],
        ];
    }

    public function test_a_newly_marketed_unit_invalidates_the_loaded_snapshot(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $unitId = (string) Str::uuid();
        $this->insertReviewUnit($package['property_id'], $unitId, 'S202', false);
        $this->insertReviewMedia($package['property_id'], (string) Str::uuid(), $package['owner']->id, $unitId);
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        DB::table('units')->where('id', $unitId)->update(['is_marketed' => true]);

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertConflict();

        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_owner_edit_that_invalidates_submission_returns_409_for_the_old_admin_form(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        DB::table('listings')->where('id', $package['listing_id'])->update(['moderation_status' => 'DRAFT', 'submitted_at' => null, 'submitted_revision' => null, 'submitted_content_revision' => null]);
        DB::table('properties')->where('id', $package['property_id'])->update(['content_revision' => 2]);
        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertConflict();

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'DRAFT', 'reviewed_by' => null]);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
    }

    public function test_later_property_edits_retain_the_initial_approval_snapshot(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertOk();

        DB::table('properties')->where('id', $package['property_id'])->update(['name' => 'Tên mới sau khi duyệt', 'content_revision' => 2]);
        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');

        $this->getJson($this->detailPath($package['listing_id']))->assertOk()->assertJsonPath('data.moderation_status', 'APPROVED')->assertJsonPath('data.property.name', 'Tên mới sau khi duyệt');
        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'APPROVED', 'approved_content_revision' => 1, 'publication_status' => 'DRAFT']);
    }

    public function test_newly_selected_media_invalidates_the_loaded_snapshot(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $mediaId = (string) Str::uuid();
        $this->insertReviewMedia($package['property_id'], $mediaId, $package['owner']->id, selected: false);
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        DB::table('property_media')->where('id', $mediaId)->update(['is_selected_for_listing' => true]);

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertConflict();

        $this->assertDatabaseCount('notification_outbox', 0);
    }

    public function test_forged_privileged_fields_return_422_without_writes(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = [...$this->decisionPayload($admin, $package['listing_id']), 'reviewed_by' => $package['owner']->id, 'publication_status' => 'PUBLISHED', 'is_admin' => true];

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertUnprocessable()->assertJsonValidationErrors(['reviewed_by', 'publication_status', 'is_admin']);

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'PENDING', 'publication_status' => 'DRAFT', 'reviewed_by' => null]);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_failure_after_audit_insert_rolls_back_review_audit_outbox_and_replay(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $thrown = false;
        DB::listen(function (QueryExecuted $query) use (&$thrown): void {
            if (! $thrown && str_starts_with(strtolower(ltrim($query->sql)), 'insert into "audit_logs"')) {
                $thrown = true;
                throw new \RuntimeException('Controlled review audit failure');
            }
        });

        $this->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertServerError();

        $this->assertTrue($thrown);
        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'PENDING', 'reviewed_by' => null, 'approved_content_revision' => null]);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('notification_outbox', 0);
        $this->assertDatabaseCount('idempotency_records', 0);
    }

    public function test_real_csrf_rejects_missing_and_wrong_token_before_review_write(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $this->withCredentials();
        config(['sanctum.stateful' => ['localhost:3000'], 'sanctum.middleware.validate_csrf_token' => EnforcingCsrfMiddleware::class]);
        $router = app(Router::class);
        $router->middlewareGroup('web', array_map(fn ($middleware): string => $middleware === PreventRequestForgery::class ? EnforcingCsrfMiddleware::class : $middleware, $router->getMiddlewareGroups()['web']));
        $response = $this->withHeader('Origin', 'http://localhost:3000')->get('/sanctum/csrf-cookie')->assertNoContent();
        $sessionId = $response->getCookie(config('session.cookie'))?->getValue();
        $xsrfCookie = $response->getCookie('XSRF-TOKEN', false)?->getValue();
        $this->assertNotEmpty($sessionId);
        $this->assertNotEmpty($xsrfCookie);
        $headers = ['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/admin/review-queue'];

        $this->withCookie(config('session.cookie'), $sessionId)->withHeaders($headers)->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertStatus(419);
        $this->withHeaders($headers + ['X-XSRF-TOKEN' => 'invalid-token'])->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertStatus(419);

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'PENDING']);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->withHeaders($headers + ['X-XSRF-TOKEN' => $xsrfCookie])->postJson($this->detailPath($package['listing_id']).'/approve', $payload)->assertOk();
        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'APPROVED']);
    }

    private function detailPath(string $listingId): string
    {
        return '/api/v1/admin/listing-reviews/'.$listingId;
    }

    /** @return array{expected_snapshot: string, client_operation_id: string} */
    private function decisionPayload(User $admin, string $listingId): array
    {
        $snapshot = $this->actingAs($admin, 'web')->getJson($this->detailPath($listingId))->assertOk()->json('data.snapshot_token');

        return ['expected_snapshot' => $snapshot, 'client_operation_id' => (string) Str::uuid()];
    }
}
