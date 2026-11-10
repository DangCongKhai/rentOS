<?php

namespace App\Notifications;

final class DomainMessage
{
    public function __construct(
        public string $from,
        public string $to,
        public string $subject,
        public string $html,
    ) {}
}
