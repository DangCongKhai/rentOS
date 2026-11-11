<?php

namespace App\Notifications;

use RuntimeException;

final class DomainMailException extends RuntimeException
{
    public function __construct(
        public string $kind,
        string $message,
    ) {
        parent::__construct($message);
    }

    public static function concurrent(string $message): self
    {
        return new self('concurrent', $message);
    }

    public static function invalid(string $message): self
    {
        return new self('invalid', $message);
    }

    public static function failed(string $message): self
    {
        return new self('failed', $message);
    }
}
