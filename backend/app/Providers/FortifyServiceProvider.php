<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Actions\Fortify\UpdateUserPassword;
use App\Http\Responses\PasswordResetLinkRequestResponse;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SuccessfulPasswordResetLinkRequestResponse::class, PasswordResetLinkRequestResponse::class);
        $this->app->singleton(FailedPasswordResetLinkRequestResponse::class, PasswordResetLinkRequestResponse::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);

        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            return rtrim((string) config('fortify.home'), '/').'/reset-password?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset());
        });

        Fortify::authenticateUsing(function (Request $request): ?User {
            $email = mb_strtolower(trim((string) $request->input('email')));
            $user = User::query()->where('email', $email)->where('account_status', 'ACTIVE')->first();

            return $user && Hash::check((string) $request->input('password'), $user->password)
                ? $user
                : null;
        });

        RateLimiter::for('login', function (Request $request): Limit {
            $email = $request->input('email');
            $throttleKey = Str::transliterate(mb_strtolower(is_string($email) ? trim($email) : '').'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('forgot-password', function (Request $request): Limit {
            $email = $request->input('email');
            $throttleKey = Str::transliterate(mb_strtolower(is_string($email) ? trim($email) : '').'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }
}
