<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureAdminSession;
use App\Http\Requests\NotificationIndexRequest;
use App\Http\Resources\NotificationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function index(NotificationIndexRequest $request): JsonResponse
    {
        $audience = (string) $request->validated('audience');
        if ($audience === 'ADMIN') {
            app(EnsureAdminSession::class)->handle($request, fn () => response()->noContent());
        }

        /** @var User $user */
        $user = $request->user();
        $perPage = 20;
        $page = max(1, (int) $request->integer('page', 1));
        $rows = DB::table('notifications')
            ->where('recipient_id', $user->id)
            ->where('audience', $audience)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->forPage($page, $perPage)
            ->get();
        $total = DB::table('notifications')
            ->where('recipient_id', $user->id)
            ->where('audience', $audience)
            ->count();
        $unread = DB::table('notifications')
            ->where('recipient_id', $user->id)
            ->where('audience', $audience)
            ->whereNull('read_at')
            ->count();

        return NotificationResource::collection($rows)
            ->additional([
                'unread_count' => $unread,
                'meta' => [
                    'current_page' => $page,
                    'last_page' => max(1, (int) ceil($total / $perPage)),
                    'per_page' => $perPage,
                    'total' => $total,
                ],
            ])
            ->response();
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $row = DB::table('notifications')->where('id', $notification)->first();
        abort_if($row === null || $row->recipient_id !== $user->id, 404, 'Không tìm thấy thông báo.');
        if ($row->audience === 'ADMIN') {
            app(EnsureAdminSession::class)->handle($request, fn () => response()->noContent());
        }
        if ($row->read_at === null) {
            DB::table('notifications')
                ->where('id', $notification)
                ->where('recipient_id', $user->id)
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
            $row = DB::table('notifications')->where('id', $notification)->first();
        }

        return (new NotificationResource($row))->response();
    }
}
