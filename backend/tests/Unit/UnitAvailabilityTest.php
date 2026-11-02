<?php

namespace Tests\Unit;

use App\Domain\Discovery\UnitAvailability;
use PHPUnit\Framework\TestCase;

class UnitAvailabilityTest extends TestCase
{
    public function test_no_blocks_is_available_now(): void
    {
        $result = UnitAvailability::describe('2026-11-01', []);

        $this->assertTrue($result['available_now']);
        $this->assertNull($result['available_from']);
        $this->assertNull($result['available_until']);
        $this->assertSame('Còn trống', $result['label']);
    }

    public function test_block_covering_today_reports_the_next_free_day(): void
    {
        $result = UnitAvailability::describe('2026-11-01', [
            ['start' => '2026-11-01', 'end' => '2027-05-01'],
        ]);

        $this->assertFalse($result['available_now']);
        $this->assertSame('2027-05-02', $result['available_from']);
        $this->assertNull($result['available_until']);
        $this->assertSame('Trống từ 02/05/2027', $result['label']);
    }

    public function test_later_block_keeps_the_unit_available_until_the_day_before(): void
    {
        $result = UnitAvailability::describe('2026-11-01', [
            ['start' => '2027-02-01', 'end' => '2027-08-01'],
        ]);

        $this->assertTrue($result['available_now']);
        $this->assertNull($result['available_from']);
        $this->assertSame('2027-01-31', $result['available_until']);
        $this->assertSame('Còn trống đến 31/01/2027', $result['label']);
    }

    public function test_stay_is_free_when_the_only_block_starts_on_the_exclusive_end(): void
    {
        $free = UnitAvailability::stayIsFree('2026-12-01', 3, [
            ['start' => '2027-03-01', 'end' => '2027-06-01'],
        ]);

        $this->assertTrue($free);
    }

    public function test_stay_is_blocked_when_a_tenancy_overlaps_the_minimum_term(): void
    {
        $free = UnitAvailability::stayIsFree('2026-12-01', 3, [
            ['start' => '2026-12-01', 'end' => '2027-01-15'],
        ]);

        $this->assertFalse($free);
    }

    public function test_block_ending_the_day_before_move_in_does_not_block_the_stay(): void
    {
        $free = UnitAvailability::stayIsFree('2026-12-01', 3, [
            ['start' => '2026-11-01', 'end' => '2026-11-30'],
        ]);

        $this->assertTrue($free);
    }
}
