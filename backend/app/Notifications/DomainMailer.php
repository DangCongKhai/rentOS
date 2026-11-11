<?php

namespace App\Notifications;

interface DomainMailer
{
    public function send(string $eventKey, DomainMessage $message): void;
}
