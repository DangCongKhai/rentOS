<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $authenticated = $request->user();
        abort_unless($authenticated instanceof User, 401);
        abort_if($authenticated->currentAccessToken() instanceof PersonalAccessToken, 403, 'API quản trị chỉ chấp nhận phiên đăng nhập trình duyệt.');
        abort_unless(Auth::guard('web')->check(), 403, 'API quản trị yêu cầu phiên đăng nhập trình duyệt.');

        $current = User::query()->find($authenticated->getAuthIdentifier());
        abort_unless($current !== null && $current->isAdmin() && $current->account_status === 'ACTIVE' && $current->hasVerifiedEmail(), 403, 'Bạn không có quyền truy cập quản trị.');
        Auth::guard('web')->setUser($current);
        $request->setUserResolver(fn (?string $guard = null): User => $current);

        $response = $next($request);
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }
}
