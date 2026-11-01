<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'supabase' => [
        'url' => env('SUPABASE_URL'),
        'service_role_key' => env('SUPABASE_SERVICE_ROLE_KEY'),
        'storage' => [
            'bucket' => env('SUPABASE_STORAGE_BUCKET', 'property-media'),
            'fixture_directory' => database_path('seeders/fixtures/media'),
            'connect_timeout' => 5,
            'timeout' => 30,
        ],
        'max_file_size_kilobytes' => (int) env('SUPABASE_STORAGE_MAX_FILE_SIZE_KILOBYTES', 10240),
        'max_media_per_property' => (int) env('SUPABASE_STORAGE_MAX_MEDIA_PER_PROPERTY', 20),
    ],

    'owner' => [
        'require_verified_email' => (bool) env('OWNER_REQUIRE_VERIFIED_EMAIL', true),
    ],

    'tinhthanhpho' => [
        'url' => env('TINHTHANHPHO_API_URL', 'https://www.tinhthanhpho.com/api/v1'),
    ],

];
