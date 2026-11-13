<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class LogApiRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        $startedAt = hrtime(true);
        $response = $next($request);

        if ($request->is('api/v1/health') || $request->is('up')) {
            return $response;
        }

        $requestId = $request->headers->get('X-Request-Id');
        if (! is_string($requestId) || $requestId === '') {
            $requestId = (string) Str::uuid();
        }

        $user = $request->user();

        Log::info('api.request', [
            'method' => $request->method(),
            'path' => '/'.$request->path(),
            'status' => $response->getStatusCode(),
            'duration_ms' => round((hrtime(true) - $startedAt) / 1_000_000, 2),
            'request_id' => $requestId,
            'user_id' => $user?->getAuthIdentifier(),
        ]);

        return $response;
    }
}
