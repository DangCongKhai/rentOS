<?php

namespace Tests\Unit;

use App\Domain\Discovery\LocationQuery;
use PHPUnit\Framework\TestCase;

class LocationQueryTest extends TestCase
{
    public function test_blank_input_returns_null(): void
    {
        $this->assertNull(LocationQuery::fromInput(null));
        $this->assertNull(LocationQuery::fromInput(''));
        $this->assertNull(LocationQuery::fromInput(" \n\t "));
    }

    public function test_collapses_whitespace_and_keeps_vietnamese_accents(): void
    {
        $query = LocationQuery::fromInput("  Hải   Châu \n");

        $this->assertNotNull($query);
        $this->assertSame('Hải Châu', $query->value());
    }

    public function test_minimum_word_similarity_threshold_is_point_four(): void
    {
        $this->assertSame(0.4, LocationQuery::MIN_WORD_SIMILARITY);
    }
}
