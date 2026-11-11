<?php

namespace App\Providers;

use App\Notifications\DomainMailer;
use App\Notifications\LogDomainMailer;
use App\Notifications\ResendDomainMailer;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

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
        //
    }
}
