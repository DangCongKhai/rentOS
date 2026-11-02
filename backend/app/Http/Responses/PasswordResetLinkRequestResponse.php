<?php

namespace App\Http\Responses;

use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse as FailedContract;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse as SuccessfulContract;
use Symfony\Component\HttpFoundation\Response;

class PasswordResetLinkRequestResponse implements FailedContract, Responsable, SuccessfulContract
{
    /**
     * The response status language key.
     */
    protected string $status;

    /**
     * Create a new response instance.
     */
    public function __construct(string $status)
    {
        $this->status = $status;
    }

    /**
     * Create an HTTP response that represents the object.
     *
     * @param  Request  $request
     * @return Response
     */
    public function toResponse($request)
    {
        if ($this->status === Password::RESET_THROTTLED) {
            if ($request->wantsJson()) {
                throw ValidationException::withMessages([
                    'email' => [trans($this->status)],
                ])->status(429);
            }

            return back()->withErrors(['email' => trans($this->status)]);
        }

        if ($this->status === Password::INVALID_USER) {
            $errorMessage = __('Email này không tồn tại.');

            if ($request->wantsJson()) {
                throw ValidationException::withMessages([
                    'email' => [$errorMessage],
                ])->status(422);
            }

            return back()->withErrors(['email' => $errorMessage]);
        }

        $message = __('Hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.');

        if ($request->wantsJson()) {
            return new JsonResponse(['message' => $message], 200);
        }

        return back()->with('status', $message);
    }
}
