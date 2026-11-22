<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MinorVersionFingerprintTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function version(): string
    {
        return $this->getJson('/api/reports/version')->assertOk()->json('version');
    }

    private function makeReport(): Report
    {
        $category = Category::firstOrCreate(['name' => 'basura']);

        return Report::create([
            'validation_status' => 'valido',
            'user_id' => User::factory()->create()->id,
            'category_id' => $category->id,
            'description' => 'Reporte de prueba',
            'latitude' => -33.45,
            'longitude' => -70.65,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
        ]);
    }

    public function test_version_changes_when_zone_id_changes_without_touching_updated_at(): void
    {
        $report = $this->makeReport();
        $zone = Zone::create([
            'name' => 'Zona', 'slug' => 'zona', 'type' => 'comuna', 'area' => 1.0,
            'boundary' => ['type' => 'Polygon', 'coordinates' => [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]],
        ]);
        $before = $this->version();

        DB::table('reports')->where('id', $report->id)->update(['zone_id' => $zone->id]);

        $this->assertNotSame($before, $this->version());
    }

    public function test_version_changes_on_two_changes_in_the_same_second(): void
    {
        Carbon::setTestNow('2026-11-01 10:00:00');
        $a = $this->makeReport();
        $b = $this->makeReport();

        Carbon::setTestNow('2026-11-01 10:00:05');
        $a->update(['status' => 'En Progreso']);
        $afterFirst = $this->version();

        $b->update(['status' => 'En Progreso']);

        $this->assertNotSame($afterFirst, $this->version());
    }
}
