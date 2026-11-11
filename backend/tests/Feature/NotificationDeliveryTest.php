<?php

namespace Tests\Feature;

use App\Actions\Notifications\RecordNotification;
use App\Actions\OwnerProperties\ListingLifecycleService;
use App\Jobs\DeliverNotification;
use App\Models\Property;
use App\Models\User;
use App\Notifications\DomainMailer;
use App\Notifications\DomainMailException;
use App\Notifications\DomainMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\CreatesListingReviewPackages;
use Tests\TestCase;

class NotificationDeliveryTest extends TestCase
{
    use CreatesListingReviewPackages, RefreshDatabase;

    private RecordingDomainMailer $mailer;

    protected function setUp(): void
    {
        parent::setUp();
        config(['queue.default' => 'database']);
        $this->mailer = new RecordingDomainMailer;
        $this->app->instance(DomainMailer::class, $this->mailer);
    }

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertReviewDatabaseIsIsolated();
    }

    public function test_duplicate_event_key_does_not_create_a_second_inbox_row_or_job(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);

        $this->actingAs($admin, 'web')
            ->postJson($this->detailPath($package['listing_id']).'/approve', $payload)
            ->assertOk();
        $this->actingAs($admin, 'web')
            ->postJson($this->detailPath($package['listing_id']).'/approve', $payload)
            ->assertOk();

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $package['owner']->id,
            'actor_id' => $admin->id,
            'audience' => 'OWNER',
            'event_key' => 'listing.approved:'.$package['listing_id'].':'.$payload['client_operation_id'],
        ]);
    }

    public function test_second_send_with_the_same_key_is_one_provider_outcome(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $this->actingAs($admin, 'web')
            ->postJson($this->detailPath($package['listing_id']).'/approve', $payload)
            ->assertOk();

        $notificationId = (string) DB::table('notifications')->value('id');
        $job = new DeliverNotification($notificationId);
        $job->handle($this->mailer);
        $job->handle($this->mailer);

        $this->assertCount(1, $this->mailer->outcomes);
        $this->assertSame(
            'listing.approved:'.$package['listing_id'].':'.$payload['client_operation_id'],
            $this->mailer->outcomes[0]['event_key'],
        );
        $this->assertDatabaseCount('jobs', 1);
    }

    public function test_provider_failure_leaves_the_listing_and_inbox_committed(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $this->actingAs($admin, 'web')
            ->postJson($this->detailPath($package['listing_id']).'/approve', $payload)
            ->assertOk();
        $this->mailer->throw = DomainMailException::failed('Resend is unavailable.');

        $this->artisan('queue:work', ['--once' => true, '--stop-when-empty' => true])->assertSuccessful();

        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'APPROVED']);
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseCount('failed_jobs', 0);
    }

    public function test_invalid_idempotent_request_moves_the_job_to_failed_jobs(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $this->actingAs($admin, 'web')
            ->postJson($this->detailPath($package['listing_id']).'/approve', $payload)
            ->assertOk();
        $this->mailer->throw = DomainMailException::invalid('Payload changed.');

        $this->artisan('queue:work', ['--once' => true, '--stop-when-empty' => true])->assertSuccessful();

        $this->assertDatabaseCount('failed_jobs', 1);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'APPROVED']);
        $this->assertDatabaseCount('notifications', 1);
    }

    public function test_only_the_recipient_can_list_and_mark_read(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $payload = $this->decisionPayload($admin, $package['listing_id']);
        $this->actingAs($admin, 'web')
            ->postJson($this->detailPath($package['listing_id']).'/approve', $payload)
            ->assertOk();
        $notificationId = DB::table('notifications')->value('id');
        $other = User::factory()->create();

        $this->asWebUser($package['owner'])
            ->getJson('/api/v1/notifications?audience=OWNER')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.audience', 'OWNER')
            ->assertJsonPath('data.0.actor_id', $admin->id)
            ->assertJsonPath('data.0.id', $notificationId);
        $this->asWebUser($package['owner'])
            ->getJson('/api/v1/notifications?audience=TENANT')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');
        $this->asWebUser($other)
            ->getJson('/api/v1/notifications?audience=OWNER')
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->asWebUser($other)
            ->postJson('/api/v1/notifications/'.$notificationId.'/read')
            ->assertNotFound();

        $firstRead = $this->asWebUser($package['owner'])
            ->postJson('/api/v1/notifications/'.$notificationId.'/read')
            ->assertOk()
            ->json('data.read_at');
        $this->assertNotNull($firstRead);
        $this->asWebUser($package['owner'])
            ->postJson('/api/v1/notifications/'.$notificationId.'/read')
            ->assertOk()
            ->assertJsonPath('data.read_at', $firstRead);
        $this->assertSame($firstRead, DB::table('notifications')->where('id', $notificationId)->value('read_at'));
    }

    public function test_non_admin_cannot_request_the_admin_audience(): void
    {
        $owner = User::factory()->create();
        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(),
            'recipient_id' => $owner->id,
            'audience' => 'ADMIN',
            'event_key' => 'admin.notice:'.$owner->id,
            'title' => 'Admin',
            'body' => 'Chỉ quản trị.',
            'resource_type' => 'listing',
            'resource_id' => (string) Str::uuid(),
            'created_at' => now(),
        ]);

        $this->actingAs($owner, 'web')
            ->getJson('/api/v1/notifications?audience=ADMIN')
            ->assertForbidden();
    }

    public function test_admin_fan_out_emails_only_new_rows(): void
    {
        $actor = User::factory()->create();
        $admins = User::factory()->count(3)->create(['is_admin' => true]);
        $suspended = User::factory()->create([
            'is_admin' => true,
            'account_status' => 'SUSPENDED',
        ]);
        $resourceId = (string) Str::uuid();
        $action = app(RecordNotification::class);
        $statements = 0;
        DB::listen(function ($query) use (&$statements): void {
            $sql = strtolower($query->sql);
            if (str_contains($sql, 'insert into notifications')) {
                $statements++;
            }
        });

        $first = $action->recordForAdmins(
            eventKey: 'listing.submitted:'.$resourceId,
            title: 'Có tin đăng chờ duyệt',
            body: 'Một tin đăng vừa được gửi để xét duyệt.',
            resourceType: 'listing',
            resourceId: $resourceId,
            actorId: $actor->id,
            sendEmail: true,
        );
        $this->assertSame(1, $statements);

        $second = $action->recordForAdmins(
            eventKey: 'listing.submitted:'.$resourceId,
            title: 'Có tin đăng chờ duyệt',
            body: 'Một tin đăng vừa được gửi để xét duyệt.',
            resourceType: 'listing',
            resourceId: $resourceId,
            actorId: $actor->id,
            sendEmail: true,
        );

        $this->assertCount(3, $first);
        $this->assertSame([], $second);
        $this->assertSame(2, $statements);
        $this->assertDatabaseCount('notifications', 3);
        $this->assertDatabaseCount('jobs', 3);
        $this->assertDatabaseMissing('notifications', [
            'recipient_id' => $suspended->id,
        ]);
        foreach ($admins as $admin) {
            $this->assertDatabaseHas('notifications', [
                'recipient_id' => $admin->id,
                'audience' => 'ADMIN',
                'actor_id' => $actor->id,
                'resource_id' => $resourceId,
            ]);
        }
    }

    public function test_repeat_record_does_not_queue_another_email(): void
    {
        $actor = User::factory()->create();
        $recipient = User::factory()->create();
        $resourceId = (string) Str::uuid();
        $action = app(RecordNotification::class);

        $action->record(
            recipientId: $recipient->id,
            audience: 'TENANT',
            eventKey: 'tenancy.proposed:'.$resourceId,
            title: 'Đề xuất kỳ thuê mới',
            body: 'Chủ nhà đã gửi đề xuất kỳ thuê.',
            resourceType: 'tenancy',
            resourceId: $resourceId,
            actorId: $actor->id,
            sendEmail: true,
        );
        $action->record(
            recipientId: $recipient->id,
            audience: 'TENANT',
            eventKey: 'tenancy.proposed:'.$resourceId,
            title: 'Đề xuất kỳ thuê mới',
            body: 'Chủ nhà đã gửi đề xuất kỳ thuê.',
            resourceType: 'tenancy',
            resourceId: $resourceId,
            actorId: $actor->id,
            sendEmail: true,
        );

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $recipient->id,
            'actor_id' => $actor->id,
        ]);
    }

    public function test_listing_submit_notifies_each_active_admin(): void
    {
        $owner = User::factory()->create();
        $package = $this->createReviewPackage([], $owner);
        DB::table('listings')->where('id', $package['listing_id'])->update([
            'moderation_status' => 'DRAFT',
            'submitted_at' => null,
            'submitted_revision' => null,
            'submitted_content_revision' => null,
        ]);
        $admins = User::factory()->count(2)->create(['is_admin' => true]);
        User::factory()->create([
            'is_admin' => true,
            'account_status' => 'SUSPENDED',
        ]);
        $statements = 0;
        DB::listen(function ($query) use (&$statements): void {
            $sql = strtolower($query->sql);
            if (str_contains($sql, 'insert into notifications')) {
                $statements++;
            }
        });

        $property = Property::query()->findOrFail($package['property_id']);
        app(ListingLifecycleService::class)->submit($owner, $property, 1);

        $this->assertSame(1, $statements);
        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseCount('jobs', 0);
        foreach ($admins as $admin) {
            $this->assertDatabaseHas('notifications', [
                'recipient_id' => $admin->id,
                'audience' => 'ADMIN',
                'actor_id' => $owner->id,
                'resource_type' => 'listing',
                'resource_id' => $package['listing_id'],
            ]);
        }
    }

    private function asWebUser(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    /** @return array{expected_snapshot: string, client_operation_id: string} */
    private function decisionPayload(User $admin, string $listingId): array
    {
        $snapshot = $this->actingAs($admin, 'web')
            ->getJson($this->detailPath($listingId))
            ->assertOk()
            ->json('data.snapshot_token');

        return ['expected_snapshot' => $snapshot, 'client_operation_id' => (string) Str::uuid()];
    }

    private function detailPath(string $listingId): string
    {
        return '/api/v1/admin/listing-reviews/'.$listingId;
    }
}

final class RecordingDomainMailer implements DomainMailer
{
    /** @var array<int, array{event_key: string, message: DomainMessage}> */
    public array $outcomes = [];

    public ?DomainMailException $throw = null;

    public function send(string $eventKey, DomainMessage $message): void
    {
        if ($this->throw !== null) {
            throw $this->throw;
        }

        foreach ($this->outcomes as $outcome) {
            if ($outcome['event_key'] === $eventKey && $outcome['message']->html === $message->html && $outcome['message']->to === $message->to && $outcome['message']->subject === $message->subject && $outcome['message']->from === $message->from) {
                return;
            }
        }

        $this->outcomes[] = ['event_key' => $eventKey, 'message' => $message];
    }
}
