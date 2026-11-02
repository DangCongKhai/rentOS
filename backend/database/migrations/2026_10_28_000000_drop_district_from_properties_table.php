<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $this->replaceDistrictRequirement(addRequirement: false);

        Schema::table('properties', function ($table) {
            $table->dropColumn('district');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function ($table) {
            $table->text('district')->nullable();
        });

        $this->replaceDistrictRequirement(addRequirement: true);
    }

    private function replaceDistrictRequirement(bool $addRequirement): void
    {
        $function = DB::selectOne(
            "SELECT pg_get_functiondef('public.validate_listing_cover(uuid)'::regprocedure) AS definition",
        )->definition;

        if ($addRequirement) {
            if (preg_match('/property\\s*\\.\\s*district/i', $function) === 1) {
                return;
            }

            $addressRequirement = '/^([ \\t]*)AND[ \\t]+btrim\\(property\\.address_line\\)[ \\t]*<>[ \\t]*\'\'[ \\t]*$/mi';
            $updatedFunction = preg_replace_callback(
                $addressRequirement,
                static fn (array $matches): string => $matches[0]."\n"
                    .$matches[1]."AND property.district IS NOT NULL\n"
                    .$matches[1]."AND btrim(property.district) <> ''",
                $function,
                1,
                $replacementCount,
            );

            if ($updatedFunction === null || $replacementCount !== 1) {
                throw new RuntimeException('Could not restore the listing address requirements.');
            }
        } else {
            $districtRequirement = '/^[ \\t]*AND[ \\t]+property\\.district[ \\t]+IS[ \\t]+NOT[ \\t]+NULL[ \\t]*\\R[ \\t]*AND[ \\t]+btrim\\(property\\.district\\)[ \\t]*<>[ \\t]*\'\'[ \\t]*(?:\\R|$)/mi';
            $updatedFunction = preg_replace($districtRequirement, '', $function, -1, $replacementCount);

            if ($updatedFunction === null) {
                throw new RuntimeException('Could not remove the listing district requirement.');
            }

            if ($replacementCount === 0 && preg_match('/property\\s*\\.\\s*district/i', $function) === 1) {
                throw new RuntimeException('Could not remove the listing district requirement.');
            }

            if ($replacementCount === 0) {
                return;
            }
        }

        DB::unprepared($updatedFunction);
    }
};
