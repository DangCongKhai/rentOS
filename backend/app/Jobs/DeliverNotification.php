<?php

namespace App\Jobs;

use App\Notifications\DomainMailer;
use App\Notifications\DomainMailException;
use App\Notifications\DomainMessage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

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

        $recipient = DB::table('users')->where('id', $notification->recipient_id)->first();
        if ($recipient === null || ! is_string($recipient->email) || $recipient->email === '') {
            $this->fail('Recipient email is missing.');

            return;
        }

        $message = new DomainMessage(
            from: $this->fromAddress(),
            to: $recipient->email,
            subject: $notification->title,
            html: $this->html($notification),
        );

        try {
            $mailer->send($notification->event_key, $message);
        } catch (DomainMailException $exception) {
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
        if ($notification->resource_type === 'listing') {
            return $base.'/owner/listings/'.$notification->resource_id;
        }

        return $base;
    }
}
