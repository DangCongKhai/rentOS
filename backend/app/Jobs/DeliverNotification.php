<?php

namespace App\Jobs;

use App\Notifications\DomainMailer;
use App\Notifications\DomainMailException;
use App\Notifications\DomainMessage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DeliverNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 8;

    public function __construct(public string $notificationId) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [60, 300, 900, 1800, 3600, 7200, 14400, 28800];
    }

    public function handle(DomainMailer $mailer): void
    {
        $notification = DB::table('notifications')->where('id', $this->notificationId)->first();
        if ($notification === null) {
            return;
        }

        $context = [
            'notification_id' => $this->notificationId,
            'recipient_id' => $notification->recipient_id,
            'event_key' => $notification->event_key,
            'mailer' => (string) config('notifications.mailer'),
        ];

        $recipient = DB::table('users')->where('id', $notification->recipient_id)->first();
        if ($recipient === null || ! is_string($recipient->email) || $recipient->email === '') {
            Log::error('notification.delivery.failed', [
                ...$context,
                'kind' => 'invalid',
                'reason' => 'recipient_email_missing',
            ]);
            $this->fail('Recipient email is missing.');

            return;
        }

        Log::info('notification.delivery.started', $context);

        $message = new DomainMessage(
            from: $this->fromAddress(),
            to: $recipient->email,
            subject: $notification->title,
            html: $this->html($notification),
        );

        try {
            $mailer->send($notification->event_key, $message);
            Log::info('notification.delivery.sent', $context);
        } catch (DomainMailException $exception) {
            Log::error('notification.delivery.failed', [
                ...$context,
                'kind' => $exception->kind,
                'reason' => $exception->getMessage(),
            ]);
            if ($exception->kind === 'concurrent') {
                $this->release();

                return;
            }
            if ($exception->kind === 'invalid') {
                $this->fail($exception);

                return;
            }

            throw $exception;
        }
    }

    private function fromAddress(): string
    {
        $address = (string) config('mail.from.address');
        $name = (string) config('mail.from.name');
        if ($name === '') {
            return $address;
        }

        return $name.' <'.$address.'>';
    }

    private function html(object $notification): string
    {
        return view('mail.notification', [
            'title' => (string) $notification->title,
            'body' => (string) $notification->body,
            'link' => $this->link($notification),
        ])->render();
    }

    private function link(object $notification): string
    {
        $base = (string) config('notifications.frontend_url');
        if (! is_string($notification->resource_id)
            || $notification->resource_id === '') {
            return $base;
        }

        if ($notification->resource_type === 'listing') {
            if ($notification->audience === 'ADMIN') {
                return $base.'/admin/review-queue/'.$notification->resource_id;
            }

            return $base.'/owner/listings/'.$notification->resource_id;
        }

        if ($notification->resource_type === 'rental_request') {
            if ($notification->audience === 'OWNER') {
                return $base.'/owner/requests/'.$notification->resource_id;
            }

            if ($notification->audience === 'TENANT') {
                return $base.'/tenant/requests/'.$notification->resource_id;
            }
        }

        if ($notification->resource_type === 'tenancy') {
            if ($notification->audience === 'OWNER') {
                return $base.'/owner/tenancies/'.$notification->resource_id;
            }

            if ($notification->audience === 'TENANT') {
                return $base.'/tenant/tenancies/'.$notification->resource_id;
            }
        }

        return $base;
    }
}
