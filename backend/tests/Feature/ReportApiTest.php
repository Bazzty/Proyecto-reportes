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
}
