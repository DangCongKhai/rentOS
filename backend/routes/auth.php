<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\ConfirmablePasswordController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\EmailVerificationPromptController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\VerifyEmailController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('register', [RegisteredUserController::class, 'create'])
        ->name('register');

    Route::post('register', [RegisteredUserController::class, 'store']);

    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');

    /*
    |--------------------------------------------------------------------------
    | PASSWORD RESET ROUTING ARCHITECTURE (Headless SPA vs Monolith Conflict)
    |--------------------------------------------------------------------------
    | Kiến trúc rentOS là mô hình Headless SPA: Frontend Next.js (port 3000) giao tiếp
    | với Backend Laravel API (port 8000) thông qua Laravel Fortify và Laravel Sanctum.
    |
    | Xung đột phát sinh khi Laravel Breeze được cài đặt song song, đăng ký các controller
    | truyền thống (Blade views + redirects) đè lên các endpoint của Fortify:
    |
    | 1. Route GET (forgot-password, reset-password/{token}):
    |    - Được giữ lại từ Breeze để phục vụ render màn hình Blade khi kiểm thử hoặc truy cập trực tiếp.
    |    - Hoàn toàn an toàn vì Fortify được cấu hình 'views => false' nên không đăng ký
    |      các route GET này, không gây xung đột định tuyến.
    |
    | 2. Route POST (forgot-password, reset-password):
    |    - Được giao toàn quyền xử lý cho Laravel Fortify nhằm đảm bảo các nguyên tắc
    |      bảo mật cốt lõi: thu hồi phiên làm việc (sessions), thu hồi Personal Access Tokens (PAT),
    |      khóa hàng giao dịch (transaction lock), kiểm thực độ phức tạp mật khẩu, và
    |      phản hồi JSON API chuẩn (200 OK / 422 Unprocessable Entity) cho Next.js.
    |    - Với browser request, Fortify tự động chuyển hướng về URL frontend được cấu hình tại
    |      config('fortify.redirects.password-reset') -> http://localhost:3000/login?reset=1.
    |
    | 3. Tương thích đặt tên route (Route Name Compatibility):
    |    - Breeze quy ước đặt tên route POST reset password là 'password.store'.
    |    - Fortify quy ước đặt tên route POST reset password là 'password.update'.
    |    - Đăng ký alias 'password.store' trỏ về Fortify NewPasswordController::class
    |      để đảm bảo khả năng tương thích ngược hoàn hảo cho bất kỳ view Blade hay
    |      bài kiểm thử kế thừa nào gọi route('password.store').
    */
    Route::get('forgot-password', [PasswordResetLinkController::class, 'create'])
        ->name('password.request');

    Route::get('reset-password/{token}', [NewPasswordController::class, 'create'])
        ->name('password.reset');

    Route::post('reset-password', [Laravel\Fortify\Http\Controllers\NewPasswordController::class, 'store'])
        ->name('password.store');

});

Route::post('login', [AuthenticatedSessionController::class, 'store']);

Route::middleware('auth')->group(function () {
    Route::get('verify-email', EmailVerificationPromptController::class)
        ->name('verification.notice');

    Route::get('verify-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    Route::get('confirm-password', [ConfirmablePasswordController::class, 'show'])
        ->name('password.confirm');

    Route::post('confirm-password', [ConfirmablePasswordController::class, 'store']);

    Route::put('password', [PasswordController::class, 'update'])->name('password.update');

    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
