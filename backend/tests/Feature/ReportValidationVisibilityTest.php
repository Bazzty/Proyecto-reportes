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

        // El endpoint devuelve puntos individuales (sin agregar): solo el reporte válido.
        $this->getJson('/api/reports/heatmap')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonStructure([['latitude', 'longitude']]);
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

    public function test_rejected_report_comments_and_confirm_are_hidden_from_guest_and_other_users()
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport($owner, $category, 'rechazado');

        // Invitado
        $this->getJson("/api/reports/{$report->id}/comments")->assertNotFound();

        // Otro usuario autenticado
        Sanctum::actingAs($other, ['*']);
        $this->getJson("/api/reports/{$report->id}/comments")->assertNotFound();
        $this->postJson("/api/reports/{$report->id}/comments", ['body' => 'hola'])->assertNotFound();
        $this->postJson("/api/reports/{$report->id}/confirm")->assertNotFound();
    }

    public function test_owner_can_read_and_comment_own_rejected_report()
    {
        $owner = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport($owner, $category, 'rechazado');
        Sanctum::actingAs($owner, ['*']);

        $this->getJson("/api/reports/{$report->id}/comments")->assertOk();
        $this->postJson("/api/reports/{$report->id}/comments", ['body' => 'hola'])->assertCreated();
    }

    public function test_admin_can_confirm_rejected_report()
    {
        $owner = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport($owner, $category, 'rechazado');

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::firstOrCreate(['name' => Role::ADMIN])->id);
        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/reports/{$report->id}/confirm")->assertOk();
    }
}
