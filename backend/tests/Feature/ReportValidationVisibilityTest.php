<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportValidationVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function makeReport(User $user, Category $category, string $validation): Report
    {
        return Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Reporte '.$validation,
            'latitude' => -41.32,
            'longitude' => -72.98,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
            'validation_status' => $validation,
        ]);
    }

    public function test_public_index_excludes_rejected_reports()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $this->makeReport($user, $category, 'valido');
        $this->makeReport($user, $category, 'rechazado');

        $this->getJson('/api/reports')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['validation_status' => 'valido'])
            ->assertJsonMissing(['validation_status' => 'rechazado']);
    }

    public function test_heatmap_excludes_rejected_reports()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $this->makeReport($user, $category, 'valido');
        $this->makeReport($user, $category, 'rechazado');

        $this->getJson('/api/reports/heatmap')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.count', 1);
    }

    public function test_show_returns_404_for_rejected_report_to_guest()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport($user, $category, 'rechazado');

        $this->getJson("/api/reports/{$report->id}")->assertNotFound();
    }

    public function test_owner_can_see_own_rejected_report()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport($user, $category, 'rechazado');
        Sanctum::actingAs($user, ['*']);

        $this->getJson("/api/reports/{$report->id}")->assertOk();

        $this->getJson('/api/user/reports')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['validation_status' => 'rechazado']);
    }

    public function test_admin_can_see_rejected_report()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport($user, $category, 'rechazado');

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::firstOrCreate(['name' => Role::ADMIN])->id);
        Sanctum::actingAs($admin, ['*']);

        $this->getJson("/api/reports/{$report->id}")->assertOk();
    }
}
