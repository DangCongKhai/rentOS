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
        ?string $actorId = null,
        bool $sendEmail = false,
    ): string {
        if (! in_array($audience, ['ADMIN', 'TENANT', 'OWNER'], true)) {
            throw new InvalidArgumentException(
                'Notification audience is not allowed.',
            );
        }
        $this->assertEventKey($eventKey);

        $id = (string) Str::uuid();
        $inserted = $this->insertReturning(
            <<<'SQL'
            INSERT INTO notifications (
                id,
                recipient_id,
                actor_id,
                audience,
                event_key,
                title,
                body,
                resource_type,
                resource_id,
                created_at
            ) VALUES (
                CAST(? AS uuid),
                CAST(? AS uuid),
                CAST(NULLIF(?, '') AS uuid),
                ?,
                ?,
                ?,
                ?,
                ?,
                CAST(? AS uuid),
                now()
            )
            ON CONFLICT (recipient_id, event_key) DO NOTHING
            RETURNING id
            SQL,
            [
                $id,
                $recipientId,
                $this->actorBinding($actorId),
                $audience,
                $eventKey,
                $title,
                $body,
                $resourceType,
                $resourceId,
            ],
        );
        $this->dispatchEmail($inserted, $sendEmail);
        if ($inserted !== []) {
            return $inserted[0];
        }

        $existing = DB::table('notifications')
            ->where('recipient_id', $recipientId)
            ->where('event_key', $eventKey)
            ->value('id');

        return (string) $existing;
    }

    /**
     * @return list<string>
     */
    public function recordForAdmins(
        string $eventKey,
        string $title,
        string $body,
        string $resourceType,
        string $resourceId,
        ?string $actorId = null,
        bool $sendEmail = false,
    ): array {
        $this->assertEventKey($eventKey);

        $inserted = $this->insertReturning(
            <<<'SQL'
            INSERT INTO notifications (
                id,
                recipient_id,
                actor_id,
                audience,
                event_key,
                title,
                body,
                resource_type,
                resource_id,
                created_at
            )
            SELECT
                gen_random_uuid(),
                users.id,
                CAST(NULLIF(?, '') AS uuid),
                'ADMIN',
                ?,
                ?,
                ?,
                ?,
                CAST(? AS uuid),
                now()
            FROM users
            WHERE users.is_admin IS TRUE
              AND users.account_status = 'ACTIVE'
            ON CONFLICT (recipient_id, event_key) DO NOTHING
            RETURNING id
            SQL,
            [
                $this->actorBinding($actorId),
                $eventKey,
                $title,
                $body,
                $resourceType,
                $resourceId,
            ],
        );
        $this->dispatchEmail($inserted, $sendEmail);

        return $inserted;
    }

    private function assertEventKey(string $eventKey): void
    {
        if (strlen($eventKey) < 1 || strlen($eventKey) > 256) {
            throw new InvalidArgumentException(
                'Notification event key must be 1 to 256 characters.',
            );
        }
    }

    private function actorBinding(?string $actorId): string
    {
        return $actorId === null || $actorId === '' ? '' : $actorId;
    }

    /**
     * @param  list<mixed>  $bindings
     * @return list<string>
     */
    private function insertReturning(string $sql, array $bindings): array
    {
        $rows = DB::select($sql, $bindings);
        $ids = [];
        foreach ($rows as $row) {
            $ids[] = (string) $row->id;
        }

        return $ids;
    }

    /**
     * @param  list<string>  $notificationIds
     */
    private function dispatchEmail(
        array $notificationIds,
        bool $sendEmail,
    ): void {
        if (! $sendEmail) {
            return;
        }

        foreach ($notificationIds as $notificationId) {
            DeliverNotification::dispatch($notificationId)
                ->onConnection('database');
        }
    }
}
