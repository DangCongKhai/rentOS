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
        $audiences = $request->audiences();
        if (in_array('ADMIN', $audiences, true)) {
            app(EnsureAdminSession::class)->handle($request, fn () => response()->noContent());
        }

        /** @var User $user */
        $user = $request->user();
        $perPage = 20;
        $page = max(1, (int) $request->integer('page', 1));
        $notifications = DB::table('notifications')
            ->where('recipient_id', $user->id)
            ->whereIn('audience', $audiences);
        $rows = (clone $notifications)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->forPage($page, $perPage)
            ->get();
        $total = (clone $notifications)->count();
        $unread = (clone $notifications)->whereNull('read_at')->count();
        $unreadRows = (clone $notifications)
            ->whereNull('read_at')
            ->select('audience')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('audience')
            ->pluck('aggregate', 'audience');
        $unreadByAudience = [];
        foreach ($audiences as $audience) {
            $unreadByAudience[$audience] = (int) $unreadRows->get($audience, 0);
        }

        return NotificationResource::collection($rows)
            ->additional([
                'unread_count' => $unread,
                'unread_by_audience' => $unreadByAudience,
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
