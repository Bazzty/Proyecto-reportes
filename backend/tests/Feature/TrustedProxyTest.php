<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrustedProxyTest extends TestCase
{
    use RefreshDatabase;

    public function test_photo_url_uses_forwarded_https_scheme_and_host()
    {
        $report = Report::create([
            'user_id' => User::factory()->create()->id,
            'category_id' => Category::firstOrCreate(['name' => 'basura'])->id,
            'description' => 'Reporte de prueba',
            'latitude' => -41.3198,
            'longitude' => -72.9833,
            'photo_path' => 'photos/a.jpg',
            'status' => 'Pendiente',
        ]);

        $response = $this->getJson("/api/reports/{$report->id}", [
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-Host' => 'demo.example.test',
        ]);

        $response->assertOk();
        $this->assertStringStartsWith('https://demo.example.test/', $response->json('photo_url'));
    }
}
