<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Support\EnforcingCsrfMiddleware;
use Tests\TestCase;

class PersonalAccessTokensTest extends TestCase
{
    use RefreshDatabase;

    private const string PATH = '/api/v1/personal-access-tokens';

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
    }

    public function test_browser_can_create_list_and_revoke_a_scoped_token(): void
    {
        $user = User::factory()->create();
        $payload = [
            'name' => ' Postman ',
            'abilities' => ['account:read', 'favourites:read', 'rental-requests:read'],
            'expires_at' => now()->addDays(7)->toDateString(),
        ];

        $response = $this->actingAs($user, 'web')->postJson(self::PATH, $payload)->assertCreated();
        $plainTextToken = $response->json('plain_text_token');
        $this->assertIsString($plainTextToken);
        $this->assertSame('Postman', $response->json('data.name'));
        $this->assertSame(['account:read', 'favourites:read', 'rental-requests:read'], $response->json('data.abilities'));
        $this->assertSame('no-store, private', $response->headers->get('Cache-Control'));

        $token = PersonalAccessToken::query()->firstOrFail();
        $secret = explode('|', $plainTextToken, 2)[1];
        $this->assertSame(hash('sha256', $secret), $token->token);
        $this->assertNotSame($plainTextToken, $token->token);
        $this->assertSame('Postman', $token->name);
        $this->assertSame(now()->addDays(7)->toDateString(), $token->expires_at->toDateString());

        Auth::forgetGuards();
        $this->actingAs($user, 'web')->getJson(self::PATH)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')->assertJsonMissing(['plain_text_token' => $plainTextToken]);
        $this->deleteJson(self::PATH.'/'.$token->getKey())->assertNoContent();
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->getKey()]);

        Auth::forgetGuards();
        $this->withToken($plainTextToken)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_creation_rejects_invalid_abilities_and_expiry_and_allows_no_expiry(): void
    {
        $user = User::factory()->create();
        $payload = [
            'name' => 'Postman',
            'abilities' => ['account:read'],
            'expires_at' => now()->addDays(7)->toDateString(),
        ];

        $this->actingAs($user, 'web')->postJson(self::PATH, $payload)->assertCreated();
        $this->postJson(self::PATH, [...$payload, 'abilities' => ['admin:*']])->assertUnprocessable()->assertJsonValidationErrors('abilities.0');
        $this->postJson(self::PATH, [...$payload, 'abilities' => ['favourites:write']])->assertUnprocessable()->assertJsonValidationErrors('abilities.0');
        $this->postJson(self::PATH, [...$payload, 'expires_at' => now()->subDay()->toDateString()])->assertUnprocessable()->assertJsonValidationErrors('expires_at');
        $this->postJson(self::PATH, [...$payload, 'expires_at' => null])->assertCreated();
        $this->assertDatabaseCount('personal_access_tokens', 2);
        $this->assertDatabaseHas('personal_access_tokens', ['name' => 'Postman', 'expires_at' => null]);
    }

    public function test_personal_access_tokens_cannot_manage_tokens_and_cannot_revoke_another_users_token(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $token = $user->createToken('cli', ['account:read'], now()->addDay())->plainTextToken;
        $otherToken = $other->createToken('other', ['account:read'], now()->addDay());

        $this->withToken($token)->getJson(self::PATH)->assertForbidden();
        $this->withToken($token)->postJson(self::PATH, [])->assertForbidden();
        $this->withToken($token)->deleteJson(self::PATH.'/'.$otherToken->accessToken->getKey())->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($user, 'web')->deleteJson(self::PATH.'/'.$otherToken->accessToken->getKey())->assertNotFound();
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $otherToken->accessToken->getKey()]);
    }

    public function test_token_management_requires_csrf_for_browser_mutations(): void
    {
        $this->withCredentials();
        config([
            'sanctum.stateful' => ['localhost:3000'],
            'sanctum.middleware.validate_csrf_token' => EnforcingCsrfMiddleware::class,
        ]);
        $router = app(Router::class);
        $router->middlewareGroup('web', array_map(
            fn ($middleware): string => $middleware === PreventRequestForgery::class ? EnforcingCsrfMiddleware::class : $middleware,
            $router->getMiddlewareGroups()['web'],
        ));

        $user = User::factory()->create();
        $this->actingAs($user, 'web');
        $origin = ['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/api-tokens/new'];
        $this->withHeaders($origin)->postJson(self::PATH, [
            'name' => 'csrf', 'abilities' => ['account:read'], 'expires_at' => now()->addDay()->toDateString(),
        ])->assertStatus(419);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
