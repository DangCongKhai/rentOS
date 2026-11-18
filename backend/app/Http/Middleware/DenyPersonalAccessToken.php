<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class DenyPersonalAccessToken
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_if(
            $request->user()?->currentAccessToken() instanceof PersonalAccessToken,
            403,
        );

        return $next($request);
    }
}
