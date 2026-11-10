<?php

namespace App\Notifications;

use Resend\Exceptions\ErrorException;
use Resend\Exceptions\TransporterException;

final class ResendDomainMailer implements DomainMailer
{
    public function send(string $eventKey, DomainMessage $message): void
    {
        $apiKey = config('services.resend.key');
        if (! is_string($apiKey) || $apiKey === '') {
            throw DomainMailException::failed('Resend API key is missing.');
        }

        try {
            \Resend::client($apiKey)->emails->send([
                'from' => $message->from,
                'to' => [$message->to],
                'subject' => $message->subject,
                'html' => $message->html,
            ], [
                'idempotency_key' => $eventKey,
            ]);
        } catch (ErrorException $exception) {
            throw $this->translate($exception);
        } catch (TransporterException $exception) {
            throw DomainMailException::failed($exception->getMessage());
        }
    }

    private function translate(ErrorException $exception): DomainMailException
    {
        $type = $exception->getErrorType();
        if ($type === 'concurrent_idempotent_requests') {
            return DomainMailException::concurrent($exception->getMessage());
        }
        if ($type === 'invalid_idempotent_request') {
            return DomainMailException::invalid($exception->getMessage());
        }

        return DomainMailException::failed($exception->getMessage());
    }
}
