<?php

namespace App\Actions\Listings;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ListListingReviews
{
    public function query(string $search = ''): Builder
    {
        $query = DB::table('listings')->join('properties', 'properties.id', '=', 'listings.property_id')->join('users as owners', 'owners.id', '=', 'properties.owner_id')
            ->where('listings.moderation_status', 'PENDING')->whereNull('listings.reviewed_at')->whereNull('listings.archived_at')->whereNull('properties.archived_at');
        $search = trim($search);
        if ($search !== '') {
            $from = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
            $to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], Str::ascii(mb_strtolower($search), 'vi')).'%';
            $query->where(function (Builder $query) use ($from, $to, $pattern): void {
                $query->whereRaw("translate(lower(listings.title), ?, ?) LIKE ? ESCAPE '!'", [$from, $to, $pattern])
                    ->orWhereRaw("translate(lower(owners.name), ?, ?) LIKE ? ESCAPE '!'", [$from, $to, $pattern]);
            });
        }

        return $query->select(['listings.id', 'listings.title', 'listings.moderation_status', 'listings.publication_status', 'listings.submitted_at', 'properties.id as property_id', 'properties.name as property_name', 'owners.id as owner_id', 'owners.name as owner_name', 'owners.email as owner_email'])
            ->selectSub(DB::table('units')->selectRaw('count(*)')->whereColumn('units.property_id', 'properties.id')->where('is_marketed', true)->whereNull('archived_at'), 'units_count')
            ->selectSub(DB::table('property_media')->selectRaw('count(*)')->whereColumn('property_media.property_id', 'properties.id')->where('is_selected_for_listing', true)->whereNull('deleted_at')->whereNull('purged_at')->where(function (Builder $query): void {
                $query->whereNull('unit_id')->orWhereExists(fn (Builder $units): Builder => $units->selectRaw('1')->from('units')->whereColumn('units.id', 'property_media.unit_id')->where('is_marketed', true)->whereNull('archived_at'));
            }), 'photos_count')
            ->orderBy('listings.submitted_at')->orderBy('listings.id');
    }

    public function summary(object $row): array
    {
        return [
            'id' => $row->id, 'title' => $row->title, 'moderation_status' => $row->moderation_status, 'publication_status' => $row->publication_status, 'submitted_at' => $row->submitted_at,
            'owner' => ['id' => $row->owner_id, 'name' => $row->owner_name, 'email' => $row->owner_email],
            'property' => ['id' => $row->property_id, 'name' => $row->property_name],
            'units_count' => (int) $row->units_count, 'photos_count' => (int) $row->photos_count,
        ];
    }
}
