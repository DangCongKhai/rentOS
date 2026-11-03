<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class AdminListingReviewMediaController extends Controller
{
    public function __invoke(string $listing, string $media): Response
    {
        Gate::authorize('viewAny', Listing::class);
        $photo = DB::table('property_media as media')->join('listings', 'listings.property_id', '=', 'media.property_id')->join('properties', 'properties.id', '=', 'media.property_id')
            ->where('listings.id', $listing)->where('media.id', $media)->where('media.is_selected_for_listing', true)
            ->whereNull('listings.archived_at')->whereNull('properties.archived_at')->whereNull('media.deleted_at')->whereNull('media.purged_at')
            ->where(function ($query): void {
                $query->whereNull('media.unit_id')->orWhereExists(fn ($units) => $units->selectRaw('1')->from('units')->whereColumn('units.id', 'media.unit_id')->where('is_marketed', true)->whereNull('archived_at'));
            })->first(['media.storage_path', 'media.mime_type', 'media.sha256']);
        abort_if($photo === null, 404);
        abort_unless(in_array($photo->mime_type, ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'], true), 404);

        $url = config('services.supabase.url');
        $key = config('services.supabase.service_role_key');
        if (filled($url) || filled($key)) {
            abort_unless(filled($url) && filled($key), 503, 'Kho ảnh chưa được cấu hình đầy đủ.');
            $path = implode('/', array_map('rawurlencode', explode('/', $photo->storage_path)));
            $bucket = rawurlencode(config('services.supabase.storage.bucket'));
            try {
                $response = Http::withToken($key)->withHeaders(['apikey' => $key])->withOptions(['allow_redirects' => false])
                    ->connectTimeout(config('services.supabase.storage.connect_timeout'))->timeout(config('services.supabase.storage.timeout'))
                    ->get(rtrim($url, '/').'/storage/v1/object/authenticated/'.$bucket.'/'.$path);
                abort_unless($response->successful(), 503, 'Không tải được ảnh từ kho lưu trữ.');
                $body = $response->body();
            } catch (ConnectionException) {
                abort(503, 'Không kết nối được kho ảnh.');
            }
        } else {
            abort_unless(app()->environment(['local', 'testing']), 503, 'Kho ảnh chưa được cấu hình.');
            $body = null;
            foreach (glob(config('services.supabase.storage.fixture_directory').'/*.png') ?: [] as $fixture) {
                if (hash_equals(strtolower($photo->sha256), hash_file('sha256', $fixture))) {
                    $body = file_get_contents($fixture);
                    break;
                }
            }
            abort_if($body === null, 503, 'Ảnh này chưa có trong kho ảnh thử nghiệm.');
        }

        abort_unless(hash_equals(strtolower($photo->sha256), hash('sha256', $body)), 503, 'Nội dung ảnh không khớp với gói tin.');

        return response($body, 200, ['Content-Type' => $photo->mime_type, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Disposition' => 'inline']);
    }
}
