<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\CreatesListingReviewPackages;
use Tests\TestCase;

class AdminListingReviewsConcurrencyTest extends TestCase
{
    use CreatesListingReviewPackages, DatabaseMigrations;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertReviewDatabaseIsIsolated();
    }

    public function test_two_separate_postgresql_requests_commit_only_one_competing_decision(): void
    {
        $approver = User::factory()->create(['is_admin' => true]);
        $rejecter = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $path = '/api/v1/admin/listing-reviews/'.$package['listing_id'];
        $snapshot = $this->actingAs($approver, 'web')->getJson($path)->assertOk()->json('data.snapshot_token');

        $results = $this->runConcurrentReviewRequests([
            ['admin' => $approver, 'path' => $path.'/approve', 'payload' => ['expected_snapshot' => $snapshot, 'client_operation_id' => (string) Str::uuid()]],
            ['admin' => $rejecter, 'path' => $path.'/reject', 'payload' => ['expected_snapshot' => $snapshot, 'client_operation_id' => (string) Str::uuid(), 'reason' => 'Thông tin cần chỉnh sửa']],
        ]);

        $this->assertSame([$approver->id, $rejecter->id], array_column($results, 'actor_id'));
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses);
        $listing = DB::table('listings')->where('id', $package['listing_id'])->first();
        $this->assertContains($listing->moderation_status, ['APPROVED', 'REJECTED']);
        $this->assertSame('DRAFT', $listing->publication_status);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
        $action = $listing->moderation_status === 'APPROVED' ? 'listing.approved' : 'listing.rejected';
        $reviewer = $listing->moderation_status === 'APPROVED' ? $approver->id : $rejecter->id;
        $this->assertSame($reviewer, $listing->reviewed_by);
        $this->assertDatabaseHas('audit_logs', ['entity_id' => $package['listing_id'], 'action' => $action, 'actor_id' => $reviewer]);
        $this->assertDatabaseHas('notification_outbox', ['event_type' => $action, 'recipient_id' => $package['owner']->id]);
    }

    public function test_concurrent_identical_retries_replay_one_committed_outcome(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $package = $this->createReviewPackage();
        $path = '/api/v1/admin/listing-reviews/'.$package['listing_id'];
        $snapshot = $this->actingAs($admin, 'web')->getJson($path)->assertOk()->json('data.snapshot_token');
        $request = ['admin' => $admin, 'path' => $path.'/approve', 'payload' => ['expected_snapshot' => $snapshot, 'client_operation_id' => (string) Str::uuid()]];

        $results = $this->runConcurrentReviewRequests([$request, $request]);

        $this->assertSame([$admin->id, $admin->id], array_column($results, 'actor_id'));
        $this->assertSame([200, 200], array_column($results, 'status'));
        $this->assertDatabaseHas('listings', ['id' => $package['listing_id'], 'moderation_status' => 'APPROVED', 'publication_status' => 'DRAFT']);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    /**
     * @param  array<int, array{admin: User, path: string, payload: array<string, mixed>}>  $requests
     * @return array<int, array{status: int, actor_id?: string, error?: string}>
     */
    private function runConcurrentReviewRequests(array $requests): array
    {
        $this->assertTrue(function_exists('pcntl_fork'), 'The PostgreSQL concurrency tests require pcntl in the isolated PHP test runtime.');
        $this->assertSame(0, DB::transactionLevel(), 'Concurrent workers need committed fixtures, not an inherited outer test transaction.');
        DB::purge('pgsql');
        $sockets = [];
        foreach ($requests as $request) {
            $pair = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
            $this->assertIsArray($pair);
            $sockets[] = $pair;
        }
        $pids = [];
        foreach ($requests as $index => $request) {
            $pid = pcntl_fork();
            $this->assertNotSame(-1, $pid);
            if ($pid === 0) {
                foreach ($sockets as $otherIndex => $pair) {
                    fclose($pair[0]);
                    if ($otherIndex !== $index) {
                        fclose($pair[1]);
                    }
                }
                $socket = $sockets[$index][1];
                stream_set_timeout($socket, 20);
                fread($socket, 1);
                try {
                    /** Forked workers inherit the snapshot request's cached Sanctum user. */
                    $this->app['auth']->forgetGuards();
                    $response = $this->actingAs($request['admin'], 'web')->postJson($request['path'], $request['payload']);
                    $result = ['status' => $response->getStatusCode(), 'actor_id' => $this->app['auth']->guard('web')->id()];
                } catch (\Throwable $failure) {
                    $result = ['status' => 0, 'error' => $failure::class.': '.$failure->getMessage()];
                }
                fwrite($socket, json_encode($result, JSON_THROW_ON_ERROR)."\n");
                fclose($socket);
                exit(0);
            }
            $pids[] = $pid;
        }
        foreach ($sockets as $pair) {
            fclose($pair[1]);
            stream_set_timeout($pair[0], 20);
            fwrite($pair[0], 'G');
        }
        $results = [];
        try {
            foreach ($sockets as $pair) {
                $line = fgets($pair[0]);
                $this->assertNotFalse($line, 'A concurrent review worker did not return a result.');
                $results[] = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
                fclose($pair[0]);
            }
        } finally {
            foreach ($pids as $pid) {
                pcntl_waitpid($pid, $status);
                $this->assertTrue(pcntl_wifexited($status));
                $this->assertSame(0, pcntl_wexitstatus($status));
            }
        }

        return $results;
    }
}
