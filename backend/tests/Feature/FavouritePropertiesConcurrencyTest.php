<?php

namespace Tests\Feature;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Concurrency;
use Tests\Support\PublicListingFixture;
use Tests\TestCase;

class FavouritePropertiesConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('rentos_test', config('database.connections.pgsql.database'));
        $this->assertContains(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost']);
    }

    public function test_concurrent_saves_create_one_user_property_relation(): void
    {
        $listing = PublicListingFixture::published();
        $user = User::factory()->create();
        $put = $this->saveInProcess($user->id, $listing->propertyId);
        $statuses = Concurrency::driver('process')->run([$put, $put], timeout: 20);
        sort($statuses);

        $this->assertSame([200, 201], $statuses);
        $this->assertDatabaseCount('favourite_properties', 1);
        $this->assertDatabaseHas('favourite_properties', ['user_id' => $user->id, 'property_id' => $listing->propertyId]);
    }

    private function saveInProcess(string $userId, string $propertyId): Closure
    {
        return static function () use ($userId, $propertyId): int {
            abort_unless(config('database.default') === 'pgsql'
                && config('database.connections.pgsql.database') === 'rentos_test'
                && in_array(config('database.connections.pgsql.host'), ['rentos-rnt04-db', '127.0.0.1', 'localhost'], true), 500);

            Auth::guard('web')->setUser(User::query()->findOrFail($userId));
            $request = Request::create('/api/v1/favourite-properties/'.$propertyId, 'PUT', server: [
                'HTTP_ACCEPT' => 'application/json',
            ]);

            return app(Kernel::class)->handle($request)->getStatusCode();
        };
    }
}
