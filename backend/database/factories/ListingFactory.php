<?php

namespace Database\Factories;

use App\Models\Listing;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Listing>
 */
class ListingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_operation_id' => fake()->uuid(),
            'title' => fake()->sentence(),
            'description' => fake()->paragraph(),
            'moderation_status' => 'DRAFT',
            'publication_status' => 'DRAFT',
        ];
    }
}
