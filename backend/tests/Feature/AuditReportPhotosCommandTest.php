<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuditReportPhotosCommandTest extends TestCase
{
    use RefreshDatabase;

    private function makeReport(?string $photoPath): Report
    {
        return Report::create([
            'user_id' => User::factory()->create()->id,
            'category_id' => Category::firstOrCreate(['name' => 'basura'])->id,
            'description' => 'Reporte de prueba',
            'latitude' => -41.3198,
            'longitude' => -72.9833,
            'photo_path' => $photoPath,
            'status' => 'Pendiente',
        ]);
    }

    public function test_passes_when_every_photo_exists_on_disk()
    {
        Storage::fake('public');
        Storage::disk('public')->put('photos/a.jpg', 'x');
        $this->makeReport('photos/a.jpg');

        $this->artisan('reports:audit-photos')->assertSuccessful();
    }

    public function test_fails_and_lists_reports_whose_photo_is_missing()
    {
        Storage::fake('public');
        $this->makeReport('photos/borrada.jpg');

        $this->artisan('reports:audit-photos')
            ->expectsOutputToContain('photos/borrada.jpg')
            ->assertFailed();
    }

    public function test_ignores_reports_without_photo_path()
    {
        Storage::fake('public');
        $this->makeReport(null);

        $this->artisan('reports:audit-photos')->assertSuccessful();
    }
}
