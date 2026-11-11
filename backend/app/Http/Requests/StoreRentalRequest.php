<?php

namespace App\Http\Requests;

use App\Models\Listing;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Laravel\Sanctum\PersonalAccessToken;

class StoreRentalRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && ! ($user->currentAccessToken() instanceof PersonalAccessToken)
            && Auth::guard('web')->id() === $user->id
            && Gate::forUser($user)->allows('submitRentalRequest', Listing::class);
    }

    protected function prepareForValidation(): void
    {
        foreach (['listing_id', 'client_operation_id', 'preferred_unit_id'] as $key) {
            if (is_string($value = $this->input($key))) {
                $this->merge([$key => strtolower($value)]);
            }
        }

        foreach (['contact_name', 'message'] as $key) {
            if (is_string($value = $this->input($key))) {
                $this->merge([$key => trim($value)]);
            }
        }

        if (is_string($phone = $this->input('contact_phone'))) {
            $this->merge(['contact_phone' => preg_replace('/[\s().-]/', '', $phone)]);
        }
    }

    public function rules(): array
    {
        return [
            'listing_id' => ['required', 'uuid'],
            'client_operation_id' => ['required', 'uuid'],
            'contact_name' => ['required', 'string', 'max:255', 'not_regex:/\x00/'],
            'contact_phone' => ['required', 'string', 'regex:/\A\+?[0-9]{8,15}\z/'],
            'desired_move_in_date' => ['bail', 'required', 'date_format:Y-m-d', 'after_or_equal:0001-01-01'],
            'desired_end_date' => ['bail', 'required', 'date_format:Y-m-d', 'after_or_equal:desired_move_in_date'],
            'preferred_unit_id' => ['nullable', 'uuid'],
            'message' => ['nullable', 'string', 'max:500', 'not_regex:/\x00/'],
            'tenant_id' => ['prohibited'],
            'status' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'contact_name.required' => 'Nhập họ và tên liên hệ.',
            'contact_name.max' => 'Họ và tên không được vượt quá 255 ký tự.',
            'contact_phone.required' => 'Nhập số điện thoại.',
            'contact_phone.regex' => 'Nhập số điện thoại hợp lệ.',
            'desired_move_in_date.required' => 'Chọn ngày dọn vào mong muốn.',
            'desired_move_in_date.date_format' => 'Ngày dọn vào không hợp lệ.',
            'desired_end_date.required' => 'Chọn ngày kết thúc mong muốn.',
            'desired_end_date.date_format' => 'Ngày kết thúc không hợp lệ.',
            'desired_end_date.after_or_equal' => 'Ngày kết thúc phải từ ngày dọn vào trở đi.',
            'message.max' => 'Lời nhắn không được vượt quá 500 ký tự.',
        ];
    }
}
