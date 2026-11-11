<?php

namespace App\Notifications;

use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Address;

final class LogDomainMailer implements DomainMailer
{
    public function send(string $eventKey, DomainMessage $message): void
    {
        $from = Address::create($message->from);

        Mail::html(
            $message->html,
            function (Message $mail) use ($message, $from, $eventKey): void {
                $mail->from($from->getAddress(), $from->getName())
                    ->to($message->to)
                    ->subject($message->subject);
                $mail->getSymfonyMessage()->getHeaders()->addTextHeader(
                    'X-Notification-Event-Key',
                    $eventKey,
                );
            },
        );
    }
}
