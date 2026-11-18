<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiThrottleTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
    }

    public function test_public_listings_are_throttled_per_ip(): void
    {
        $this->travel(1)->minutes();

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $this->getJson('/api/v1/listings')->assertOk();
        }

        $this->getJson('/api/v1/listings')
            ->assertTooManyRequests()
            ->assertJsonPath('message', 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.')
            ->assertHeader('Retry-After')
            ->assertHeader('X-RateLimit-Limit', '60');
    }

    public function test_personal_access_token_requests_are_throttled_per_token(): void
    {
        $this->travel(1)->minutes();

        $user = User::factory()->create();
        $token = $user->createToken('cli', ['account:read'], now()->addHour())->plainTextToken;

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $this->withToken($token)->getJson('/api/v1/me')->assertOk();
        }

        $this->withToken($token)->getJson('/api/v1/me')
            ->assertTooManyRequests()
            ->assertJsonPath('message', 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.')
            ->assertHeader('Retry-After')
            ->assertHeader('X-RateLimit-Limit', '60');
    }

    public function test_personal_access_token_creation_is_throttled_per_user(): void
    {
        $this->travel(1)->minutes();

        $user = User::factory()->create();
        $payload = [
            'name' => 'Throttle probe',
            'abilities' => ['account:read'],
            'expires_at' => now()->addDays(7)->toDateString(),
        ];

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->actingAs($user, 'web')
                ->postJson('/api/v1/personal-access-tokens', [
                    ...$payload,
                    'name' => 'Throttle probe '.$attempt,
                ])
                ->assertCreated();
        }

        $this->actingAs($user, 'web')
            ->postJson('/api/v1/personal-access-tokens', [
                ...$payload,
                'name' => 'Throttle probe blocked',
            ])
            ->assertTooManyRequests()
            ->assertJsonPath('message', 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.')
            ->assertHeader('Retry-After')
            ->assertHeader('X-RateLimit-Limit', '5');
    }
}
