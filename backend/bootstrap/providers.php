<?php

use App\Providers\AppServiceProvider;
use App\Providers\FortifyServiceProvider;
use App\Providers\TelescopeServiceProvider;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

$providers = [
    AppServiceProvider::class,
    FortifyServiceProvider::class,
];

if (class_exists(TelescopeApplicationServiceProvider::class)) {
    $providers[] = TelescopeServiceProvider::class;
}

return $providers;
