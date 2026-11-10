<?php

namespace Database\Factories;

use App\Models\Listing;
use App\Models\RentalRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<RentalRequest> */
class RentalRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'listing_id' => Listing::factory(),
            'tenant_id' => User::factory(),
            'client_operation_id' => (string) Str::uuid(),
            'contact_name' => fake()->name(),
            'contact_phone' => '0901234567',
            'desired_move_in_date' => '2027-01-01',
            'desired_end_date' => '2027-03-31',
            'message' => '',
            'status' => 'PENDING',
        ];
    }
}
