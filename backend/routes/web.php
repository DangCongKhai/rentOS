<?php

use Illuminate\Support\Facades\Route;

Route::redirect('/', rtrim((string) config('fortify.home'), '/'));
