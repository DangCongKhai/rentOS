<?php

namespace App\Actions\Notifications;

use App\Jobs\DeliverNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class RecordNotification
{
    public function record(
        string $recipientId,
        string $audience,
        string $eventKey,
        string $title,
        string $body,
        string $resourceType,
        string $resourceId,
        bool $sendEmail = false,
    ): string {
        if (! in_array($audience, ['ADMIN', 'TENANT', 'OWNER'], true)) {
            throw new InvalidArgumentException('Notification audience is not allowed.');
        }
        if (strlen($eventKey) < 1 || strlen($eventKey) > 256) {
            throw new InvalidArgumentException('Notification event key must be 1 to 256 characters.');
        }

        $id = (string) Str::uuid();
        DB::table('notifications')->insert([
            'id' => $id,
            'recipient_id' => $recipientId,
            'audience' => $audience,
            'event_key' => $eventKey,
            'title' => $title,
            'body' => $body,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'created_at' => now(),
        ]);
        if ($sendEmail) {
            DeliverNotification::dispatch($id)->onConnection('database');
        }

        return $id;
    }
}
