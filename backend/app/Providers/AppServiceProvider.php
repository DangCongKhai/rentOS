<?php

namespace App\Providers;

use App\Notifications\DomainMailer;
use App\Notifications\LogDomainMailer;
use App\Notifications\ResendDomainMailer;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(DomainMailer::class, function ($app): DomainMailer {
            $mailer = (string) config('notifications.mailer');

            return match ($mailer) {
                'resend' => $app->make(ResendDomainMailer::class),
                'log' => $app->make(LogDomainMailer::class),
                default => throw new InvalidArgumentException('Unknown notification mailer ['.$mailer.'].'),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('public-api', function (Request $request): Limit {
            return Limit::perMinute(60)
                ->by($request->ip() ?? 'unknown')
                ->response($this->tooManyRequestsResponse());
        });

        RateLimiter::for('api', function (Request $request): Limit {
            $user = $request->user();
            $token = $user?->currentAccessToken();

            if ($token instanceof PersonalAccessToken) {
                return Limit::perMinute(60)
                    ->by('token:'.$token->id)
                    ->response($this->tooManyRequestsResponse());
            }

            if ($user !== null) {
                return Limit::perMinute(120)
                    ->by('user:'.$user->id)
                    ->response($this->tooManyRequestsResponse());
            }

            return Limit::perMinute(60)
                ->by($request->ip() ?? 'unknown')
                ->response($this->tooManyRequestsResponse());
        });

        RateLimiter::for('token-create', function (Request $request): Limit {
            $userId = $request->user()?->getAuthIdentifier() ?? $request->ip() ?? 'unknown';

            return Limit::perMinute(5)
                ->by('token-create:'.$userId)
                ->response($this->tooManyRequestsResponse());
        });
    }

    /**
     * @return callable(Request, array<string, string>): Response
     */
    private function tooManyRequestsResponse(): callable
    {
        return function (Request $request, array $headers): Response {
            return response()->json([
                'message' => 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.',
            ], 429, $headers);
        };
    }
}
