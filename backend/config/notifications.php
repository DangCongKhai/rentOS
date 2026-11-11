<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Domain notification mailer
    |--------------------------------------------------------------------------
    |
    | log sends through Mail so Telescope records it. With MAIL_MAILER=log
    | that send is not delivered. resend calls the Resend SDK with the
    | inbox event_key as the idempotency key. This is separate from
    | MAIL_MAILER, which Fortify keeps on log.
    |
    */

    'mailer' => env('NOTIFICATIONS_MAILER', 'log'),

    'frontend_url' => rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/'),

];
