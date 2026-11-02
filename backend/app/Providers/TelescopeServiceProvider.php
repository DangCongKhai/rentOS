<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Laravel\Telescope\EntryType;
use Laravel\Telescope\IncomingEntry;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

class TelescopeServiceProvider extends TelescopeApplicationServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Telescope::night();

        $this->hideSensitiveRequestDetails();

        $isLocal = $this->app->environment('local');

        Telescope::filter(function (IncomingEntry $entry) use ($isLocal) {
            if (! $isLocal) {
                if ($entry->type === EntryType::MAIL) {
                    return false;
                }

                if ($entry->type === EntryType::REQUEST && preg_match(
                    '#^/(login|logout|register|email/|user/|api/v1/me(?:\?|$))#',
                    (string) ($entry->content['uri'] ?? ''),
                ) === 1) {
                    return false;
                }

                if ($entry->type === EntryType::QUERY && preg_match(
                    '/\b(users|sessions|personal_access_tokens|password_reset_tokens)\b/i',
                    (string) ($entry->content['sql'] ?? ''),
                ) === 1) {
                    return false;
                }

                if ($entry->type === EntryType::MODEL && preg_match(
                    '/^(App\\\\Models\\\\User|Laravel\\\\Sanctum\\\\PersonalAccessToken):/',
                    (string) ($entry->content['model'] ?? ''),
                ) === 1) {
                    return false;
                }
            }

            return $isLocal ||
                   $entry->isReportableException() ||
                   $entry->isFailedRequest() ||
                   $entry->isFailedJob() ||
                   $entry->isScheduledTask() ||
                   $entry->hasMonitoredTag();
        });
    }

    /**
     * Prevent sensitive request details from being logged by Telescope.
     */
    protected function hideSensitiveRequestDetails(): void
    {
        Telescope::hideRequestParameters([
            '_token',
            'password',
            'password_confirmation',
            'current_password',
            'email',
            'signature',
            'token',
        ]);

        Telescope::hideRequestHeaders([
            'authorization',
            'cookie',
            'set-cookie',
            'x-csrf-token',
            'x-xsrf-token',
        ]);
    }

    /**
     * Register the Telescope gate.
     *
     * This gate determines who can access Telescope in non-local environments.
     */
    protected function gate(): void
    {
        Gate::define('viewTelescope', function (User $user) {
            return in_array($user->email, [
                //
            ]);
        });
    }
}
