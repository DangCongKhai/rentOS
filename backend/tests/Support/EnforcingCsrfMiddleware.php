<?php

namespace Tests\Support;

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;

/** Force the framework's real CSRF checks on for feature tests. */
class EnforcingCsrfMiddleware extends PreventRequestForgery
{
    protected function runningUnitTests(): bool
    {
        return false;
    }
}
