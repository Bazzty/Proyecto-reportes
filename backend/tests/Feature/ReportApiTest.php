<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_report_with_photo()
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);

        Sanctum::actingAs($user, ['*']);

        $response = $this->postJson('/api/reports', [
            'description' => 'Basura en la vereda',
            'latitude' => -33.4569,
            'longitude' => -70.6483,
            'category_id' => $category->id,
            'photo' => UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg'),
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'description',
                'latitude',
                'longitude',
                'photo_url',
                'status',
                'category' => ['id', 'name'],
                'user' => ['id', 'name'],
                'confirmations_count',
                'confirmed_by_me',
                'created_at',
            ]);

        $photoUrl = $response->json('photo_url');
        $this->assertStringContainsString('/storage/photos/', $photoUrl);

        $storedPath = str_replace(url('/storage/'), '', $photoUrl);
        Storage::disk('public')->assertExists(ltrim($storedPath, '/'));

        $this->assertDatabaseHas('reports', [
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Basura en la vereda',
            'status' => 'Pendiente',
        ]);
    }

    public function test_user_can_list_reports()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'escombros']);

        $report = Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Escombros en la vereda',
            'latitude' => -33.4580,
            'longitude' => -70.6500,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
        ]);

        Sanctum::actingAs($user, ['*']);

        $response = $this->getJson('/api/reports');

        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonFragment([
                'description' => 'Escombros en la vereda',
                'latitude' => -33.4580,
                'longitude' => -70.6500,
                'status' => 'Pendiente',
                'category' => ['id' => $category->id, 'name' => 'escombros'],
                'user' => ['id' => $user->id, 'name' => $user->name],
            ]);
    }

    public function test_user_can_list_own_reports_only()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $category = Category::create(['name' => 'aguas']);

        Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Mi reporte',
            'latitude' => -33.4489,
            'longitude' => -70.6693,
            'photo_path' => 'photos/a.jpg',
            'status' => 'Pendiente',
        ]);

        Report::create([
            'user_id' => $other->id,
            'category_id' => $category->id,
            'description' => 'Reporte de otro usuario',
            'latitude' => -33.4500,
            'longitude' => -70.6700,
            'photo_path' => 'photos/b.jpg',
            'status' => 'Pendiente',
        ]);

        Sanctum::actingAs($user, ['*']);

        $response = $this->getJson('/api/user/reports');

        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonFragment(['description' => 'Mi reporte'])
            ->assertJsonMissing(['description' => 'Reporte de otro usuario']);
    }

    public function test_guest_can_list_reports_without_token()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'otro']);

        Report::create([
            'user_id'     => $user->id,
            'category_id' => $category->id,
            'description' => 'Reporte público',
            'latitude'    => -41.3198,
            'longitude'   => -72.9833,
            'photo_path'  => null,
            'status'      => 'Pendiente',
        ]);

        $this->getJson('/api/reports')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment([
                'confirmations_count' => 0,
                'confirmed_by_me'     => false,
            ]);
    }

    public function test_guest_can_view_report_detail_without_token()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);

        $report = Report::create([
            'user_id'     => $user->id,
            'category_id' => $category->id,
            'description' => 'Detalle público',
            'latitude'    => -41.3198,
            'longitude'   => -72.9833,
            'photo_path'  => null,
            'status'      => 'Pendiente',
        ]);

        $this->getJson("/api/reports/{$report->id}")
            ->assertOk()
            ->assertJsonFragment(['description' => 'Detalle público']);
    }

    public function test_heatmap_returns_only_coordinates()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);

        Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Punto 1',
            'latitude' => -33.4489,
            'longitude' => -70.6693,
            'photo_path' => 'photos/a.jpg',
            'status' => 'Pendiente',
        ]);

        Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Punto 2',
            'latitude' => -33.4600,
            'longitude' => -70.6800,
            'photo_path' => 'photos/b.jpg',
            'status' => 'Resuelto',
        ]);

        Sanctum::actingAs($user, ['*']);

        $response = $this->getJson('/api/reports/heatmap');

        $response->assertStatus(200)
            ->assertJsonCount(2)
            ->assertJsonFragment(['latitude' => -33.4489, 'longitude' => -70.6693])
            ->assertJsonFragment(['latitude' => -33.4600, 'longitude' => -70.6800]);

        // Solo coordenadas, sin description ni status
        $first = $response->json()[0];
        $this->assertArrayHasKey('latitude', $first);
        $this->assertArrayHasKey('longitude', $first);
        $this->assertArrayNotHasKey('description', $first);
        $this->assertArrayNotHasKey('status', $first);
    }
}
